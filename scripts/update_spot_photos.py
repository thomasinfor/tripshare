#!/usr/bin/env python3
"""
Surgically update spot `images` arrays in TripShare JSON data without touching
any other fields or OSRM driving_route coordinates.

Usage:
  python3 scripts/update_spot_photos.py --spec '[{"trip":"iceland","spot_id":"2026-09-13-spot-1","add":[...],"remove":[...]}]'
  python3 scripts/update_spot_photos.py --spec-file /tmp/photo_ops.json [--file src/data/trips.json] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata

VALID_ASSET_ID_RE = re.compile(r"^[a-zA-Z0-9-]+$")


def slugify_trip_name(value: str, fallback: str = "trip") -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower().strip()).strip("-")
    return cleaned or fallback


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update spot photos in TripShare trips JSON.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--spec", help="JSON array (or single object) of spot photo operations.")
    group.add_argument("--spec-file", help="Path to a JSON file containing spot photo operations.")
    parser.add_argument(
        "--file",
        default="src/data/trips.json",
        help="Path to the target trips JSON file (default: src/data/trips.json).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print changes without writing the file.",
    )
    return parser.parse_args()


def load_operations(args: argparse.Namespace) -> list[dict]:
    if args.spec is not None:
        raw_spec = args.spec
    else:
        with open(args.spec_file, "r", encoding="utf-8") as f:
            raw_spec = f.read()

    parsed = json.loads(raw_spec)
    ops = parsed if isinstance(parsed, list) else [parsed]
    if not ops:
        raise ValueError("Operations spec cannot be empty.")

    for i, op in enumerate(ops):
        if not isinstance(op, dict):
            raise ValueError(f"Operation #{i} must be an object.")
        if not op.get("spot_id"):
            raise ValueError(f"Operation #{i} is missing 'spot_id'.")
        for field in ("add", "remove", "order"):
            if field not in op or op[field] is None:
                continue
            vals = op[field]
            if not isinstance(vals, list) or not all(isinstance(v, str) for v in vals):
                raise ValueError(f"Operation #{i} field '{field}' must be a list of strings.")
            if field in ("add", "order"):
                for asset_id in vals:
                    if not VALID_ASSET_ID_RE.match(asset_id):
                        raise ValueError(f"Invalid Immich asset id '{asset_id}' in operation #{i}.")
    return ops


def build_spot_index(trips: list[dict]) -> dict[tuple[str, str], tuple[dict, str]]:
    """Map (trip_slug, spot_id) -> (spot_dict, display_slug) preserving JS slugifyTripName rules."""
    used_slugs: set[str] = set()
    index: dict[tuple[str, str], tuple[dict, str]] = {}

    for t_idx, trip in enumerate(trips):
        raw_name = trip.get("slug") or trip.get("trip") or f"Trip {t_idx + 1}"
        base_slug = slugify_trip_name(raw_name, f"trip-{t_idx + 1}")
        slug = base_slug
        suffix = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        used_slugs.add(slug)

        itinerary = trip.get("itinerary", [])
        days = itinerary if isinstance(itinerary, list) else [itinerary]
        for d_idx, day in enumerate(days):
            for s_idx, spot in enumerate(day.get("spots", [])):
                sid = spot.get("id") or f"spot-{d_idx}-{s_idx}"
                index[(slug, sid)] = (spot, slug)

    return index


def main() -> int:
    args = parse_args()
    try:
        ops = load_operations(args)
    except Exception as exc:
        print(f"Error parsing operations spec: {exc}", file=sys.stderr)
        return 1

    target_path = os.path.abspath(args.file)
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            raw_text = f.read()
    except OSError as exc:
        print(f"Error reading {target_path}: {exc}", file=sys.stderr)
        return 1

    had_trailing_newline = raw_text.endswith("\n")
    parsed_data = json.loads(raw_text)
    was_array = isinstance(parsed_data, list)
    trips = parsed_data if was_array else [parsed_data]

    spot_index = build_spot_index(trips)
    first_slug = next(iter(spot_index.keys()))[0] if spot_index else "trip"

    summaries: list[str] = []
    for i, op in enumerate(ops):
        req_trip = slugify_trip_name(str(op.get("trip") or first_slug), first_slug)
        spot_id = str(op["spot_id"])
        entry = spot_index.get((req_trip, spot_id))
        if not entry:
            print(
                f"Error: Spot ({req_trip!r}, {spot_id!r}) from operation #{i} not found in {args.file}.",
                file=sys.stderr,
            )
            return 1

        spot, resolved_slug = entry
        current_images: list[str] = list(spot.get("images") or [])
        before_count = len(current_images)

        remove_set = set(op.get("remove") or [])
        removed_count = sum(1 for img in current_images if img in remove_set)
        updated_images = [img for img in current_images if img not in remove_set]

        existing_set = set(updated_images)
        added_count = 0
        for add_id in op.get("add") or []:
            if add_id not in existing_set:
                updated_images.append(add_id)
                existing_set.add(add_id)
                added_count += 1

        pre_order = list(updated_images)
        requested_order = op.get("order") or []
        if requested_order:
            active_set = set(updated_images)
            seen_order: set[str] = set()
            reordered = [
                img
                for img in requested_order
                if img in active_set and not (img in seen_order or seen_order.add(img))
            ]
            reordered.extend(img for img in updated_images if img not in seen_order)
            updated_images = reordered
        reordered_flag = updated_images != pre_order

        spot["images"] = updated_images
        after_count = len(updated_images)
        spot_name = spot.get("name", spot_id)
        reorder_note = ", reordered" if reordered_flag else ""
        summaries.append(
            f"[{resolved_slug}] {spot_id} ({spot_name}): {before_count} -> {after_count} photos "
            f"(+{added_count} added, -{removed_count} removed{reorder_note})"
        )

    out_obj = trips if was_array else trips[0]
    serialized = json.dumps(out_obj, indent=2, ensure_ascii=False)
    if had_trailing_newline:
        serialized += "\n"

    # Re-parse serialized output as a final integrity check
    json.loads(serialized)

    if args.dry_run:
        print("DRY RUN (no file written):")
    else:
        target_dir = os.path.dirname(target_path)
        fd, tmp_path = tempfile.mkstemp(prefix=".trips-update-", suffix=".json", dir=target_dir)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tmp_f:
                tmp_f.write(serialized)
            os.replace(tmp_path, target_path)
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    for line in summaries:
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())

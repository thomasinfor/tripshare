import { NormalizedTrip } from '../types';

export interface SpotPhotoDraft {
  addedIds: string[];
  removedIds: string[];
  orderedIds?: string[];
}

// Keyed by `${tripSlug}::${spotId}`
export type TripPhotoDraftMap = Record<string, SpotPhotoDraft>;

export interface DraftSummaryEntry {
  key: string;
  tripSlug: string;
  tripTitle: string;
  dayIndex: number;
  dayNumber: number;
  dayDate: string;
  spotIndex: number;
  spotNumber: number;
  spotId: string;
  spotName: string;
  addedIds: string[];
  removedIds: string[];
  isReordered: boolean;
  orderedIds?: string[];
}

const STORAGE_KEY = 'tripshare_photo_drafts_v1';
const UUID_GLOBAL_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

export function makeSpotDraftKey(tripSlug: string, spotId: string): string {
  return `${tripSlug}::${spotId}`;
}

export function extractImmichAssetIds(rawInput: string): {
  ids: string[];
  invalidTokens: string[];
} {
  const tokens = rawInput
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ids: string[] = [];
  const seen = new Set<string>();
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const matches = token.match(UUID_GLOBAL_RE);
    if (!matches || matches.length === 0) {
      invalidTokens.push(token);
      continue;
    }
    for (const m of matches) {
      const normalized = m.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ids.push(normalized);
      }
    }
  }

  return { ids, invalidTokens };
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function getDefaultActiveOrder(
  baseImages: string[],
  draft?: SpotPhotoDraft
): string[] {
  const removedSet = new Set(draft?.removedIds ?? []);
  const result = baseImages.filter((id) => !removedSet.has(id));
  const seen = new Set(baseImages);

  for (const addId of draft?.addedIds ?? []) {
    if (!seen.has(addId)) {
      seen.add(addId);
      result.push(addId);
    }
  }

  return result;
}

function mergeOrderedIds(defaultActive: string[], orderedIds?: string[]): string[] {
  if (!orderedIds || orderedIds.length === 0) return defaultActive;

  const activeSet = new Set(defaultActive);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of orderedIds) {
    if (activeSet.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of defaultActive) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

export function applySpotDraft(
  baseImages: string[],
  draft?: SpotPhotoDraft,
  includeRemoved = false
): string[] {
  if (!draft) return baseImages;

  const defaultActive = getDefaultActiveOrder(baseImages, draft);
  if (draft.orderedIds && draft.orderedIds.length > 0) {
    const activeOrdered = mergeOrderedIds(defaultActive, draft.orderedIds);
    if (!includeRemoved) return activeOrdered;

    const baseSet = new Set(baseImages);
    const activeSet = new Set(activeOrdered);
    const removedTrailing = draft.removedIds.filter(
      (id) => baseSet.has(id) && !activeSet.has(id)
    );
    return [...activeOrdered, ...removedTrailing];
  }

  if (!includeRemoved) return defaultActive;

  const result = [...baseImages];
  const seen = new Set(baseImages);
  for (const addId of draft.addedIds) {
    if (!seen.has(addId)) {
      seen.add(addId);
      result.push(addId);
    }
  }
  return result;
}

export function normalizeSpotDraft(
  baseImages: string[],
  draft: SpotPhotoDraft
): SpotPhotoDraft | null {
  const baseSet = new Set(baseImages);
  const addedSeen = new Set<string>();
  const addedIds: string[] = [];
  for (const id of draft.addedIds) {
    if (!baseSet.has(id) && !addedSeen.has(id)) {
      addedSeen.add(id);
      addedIds.push(id);
    }
  }

  const removedSeen = new Set<string>();
  const removedIds: string[] = [];
  for (const id of draft.removedIds) {
    if (baseSet.has(id) && !removedSeen.has(id)) {
      removedSeen.add(id);
      removedIds.push(id);
    }
  }

  const defaultActive = getDefaultActiveOrder(baseImages, { addedIds, removedIds });
  const mergedOrdered = mergeOrderedIds(defaultActive, draft.orderedIds);
  const isReordered =
    Boolean(draft.orderedIds && draft.orderedIds.length > 0) &&
    !sameStringArray(mergedOrdered, defaultActive);

  if (addedIds.length === 0 && removedIds.length === 0 && !isReordered) {
    return null;
  }

  return isReordered
    ? { addedIds, removedIds, orderedIds: mergedOrdered }
    : { addedIds, removedIds };
}

export function reconcileDraftsWithTrips(
  drafts: TripPhotoDraftMap,
  trips: NormalizedTrip[]
): TripPhotoDraftMap {
  const keys = Object.keys(drafts);
  if (keys.length === 0) return drafts;

  const spotImagesMap = new Map<string, string[]>();
  for (const trip of trips) {
    for (const day of trip.days) {
      for (const spot of day.spots) {
        spotImagesMap.set(makeSpotDraftKey(trip.slug, spot.id), spot.images);
      }
    }
  }

  let changed = false;
  const next: TripPhotoDraftMap = {};

  for (const key of keys) {
    const draft = drafts[key];
    const baseImages = spotImagesMap.get(key);
    if (!baseImages) {
      changed = true;
      continue;
    }

    const normalized = normalizeSpotDraft(baseImages, draft);
    if (!normalized) {
      changed = true;
      continue;
    }

    const orderSame =
      (normalized.orderedIds === undefined && draft.orderedIds === undefined) ||
      (normalized.orderedIds !== undefined &&
        draft.orderedIds !== undefined &&
        sameStringArray(normalized.orderedIds, draft.orderedIds));

    if (
      !sameStringArray(normalized.addedIds, draft.addedIds) ||
      !sameStringArray(normalized.removedIds, draft.removedIds) ||
      !orderSame
    ) {
      changed = true;
    }

    next[key] = normalized;
  }

  return changed ? next : drafts;
}

export function countTotalDraftChanges(drafts: TripPhotoDraftMap): {
  totalChanges: number;
  spotCount: number;
  totalAdded: number;
  totalRemoved: number;
  totalReordered: number;
} {
  let spotCount = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalReordered = 0;

  for (const draft of Object.values(drafts)) {
    const a = draft.addedIds.length;
    const r = draft.removedIds.length;
    const o = draft.orderedIds && draft.orderedIds.length > 0 ? 1 : 0;
    if (a > 0 || r > 0 || o > 0) {
      spotCount++;
      totalAdded += a;
      totalRemoved += r;
      totalReordered += o;
    }
  }

  return {
    totalChanges: totalAdded + totalRemoved + totalReordered,
    spotCount,
    totalAdded,
    totalRemoved,
    totalReordered,
  };
}

export function loadPhotoDrafts(): TripPhotoDraftMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const cleaned: TripPhotoDraftMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== 'object') continue;
      const obj = v as Partial<SpotPhotoDraft>;
      const addedIds = Array.isArray(obj.addedIds)
        ? obj.addedIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];
      const removedIds = Array.isArray(obj.removedIds)
        ? obj.removedIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];
      const orderedIds = Array.isArray(obj.orderedIds)
        ? obj.orderedIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : undefined;
      if (addedIds.length > 0 || removedIds.length > 0 || (orderedIds && orderedIds.length > 0)) {
        cleaned[k] = orderedIds && orderedIds.length > 0
          ? { addedIds, removedIds, orderedIds }
          : { addedIds, removedIds };
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function savePhotoDrafts(drafts: TripPhotoDraftMap): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(drafts).filter(
      ([, v]) =>
        v.addedIds.length > 0 ||
        v.removedIds.length > 0 ||
        Boolean(v.orderedIds && v.orderedIds.length > 0)
    );
    if (entries.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function escapeSingleQuotedShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildAgentPhotoEditPrompt(
  trips: NormalizedTrip[],
  drafts: TripPhotoDraftMap
): {
  entries: DraftSummaryEntry[];
  prompt: string;
  cliSpecJson: string;
  totalAdded: number;
  totalRemoved: number;
  totalReordered: number;
} {
  const entries: DraftSummaryEntry[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalReordered = 0;

  for (const trip of trips) {
    trip.days.forEach((day, dayIndex) => {
      day.spots.forEach((spot, spotIndex) => {
        const key = makeSpotDraftKey(trip.slug, spot.id);
        const draft = drafts[key];
        if (!draft) return;

        const isReordered = Boolean(draft.orderedIds && draft.orderedIds.length > 0);
        if (draft.addedIds.length === 0 && draft.removedIds.length === 0 && !isReordered) {
          return;
        }

        const orderedIds = isReordered ? applySpotDraft(spot.images, draft, false) : undefined;
        totalAdded += draft.addedIds.length;
        totalRemoved += draft.removedIds.length;
        if (isReordered) totalReordered++;

        entries.push({
          key,
          tripSlug: trip.slug,
          tripTitle: trip.title,
          dayIndex,
          dayNumber: dayIndex + 1,
          dayDate: day.date,
          spotIndex,
          spotNumber: spotIndex + 1,
          spotId: spot.id,
          spotName: spot.name,
          addedIds: [...draft.addedIds],
          removedIds: [...draft.removedIds],
          isReordered,
          orderedIds,
        });
      });
    });
  }

  const cliSpec = entries.map((e) => ({
    trip: e.tripSlug,
    spot_id: e.spotId,
    add: e.addedIds,
    remove: e.removedIds,
    ...(e.orderedIds ? { order: e.orderedIds } : {}),
  }));
  const cliSpecJson = JSON.stringify(cliSpec);

  const summaryLines = entries.map((e) => {
    const parts: string[] = [
      `- [${e.tripSlug}] Day ${e.dayNumber} (${e.dayDate}) · Spot ${e.spotNumber} "${e.spotName}" (id: \`${e.spotId}\`)`,
    ];
    if (e.addedIds.length > 0) {
      parts.push(`  + Add (${e.addedIds.length}): ${e.addedIds.join(', ')}`);
    }
    if (e.removedIds.length > 0) {
      parts.push(`  - Remove (${e.removedIds.length}): ${e.removedIds.join(', ')}`);
    }
    if (e.orderedIds) {
      parts.push(`  ~ Reordered (${e.orderedIds.length} photos): ${e.orderedIds.join(', ')}`);
    }
    return parts.join('\n');
  });

  const command = `python3 scripts/update_spot_photos.py --spec ${escapeSingleQuotedShellArg(cliSpecJson)}`;

  const changeCountParts = [`+${totalAdded} added`, `-${totalRemoved} removed`];
  if (totalReordered > 0) {
    changeCountParts.push(`${totalReordered} reordered`);
  }

  const prompt = [
    `Update spot photos in \`src/data/trips.json\` using the following staged edits (${entries.length} spot${entries.length === 1 ? '' : 's'}, ${changeCountParts.join(', ')}).`,
    `Do NOT touch \`dist/\` or restart PM2 unless I explicitly ask.`,
    '',
    'Staged changes:',
    ...summaryLines,
    '',
    'Apply cleanly by running:',
    '```bash',
    command,
    '```',
  ].join('\n');

  return {
    entries,
    prompt,
    cliSpecJson,
    totalAdded,
    totalRemoved,
    totalReordered,
  };
}

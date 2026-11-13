import React, { useEffect, useState } from 'react';
import { NormalizedTrip } from '../types';
import {
  AppBar,
  Box,
  Card,
  CardActionArea,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import { calculateDayDistance, getTripMonogram } from '../utils/geo';
import {
  getMediaUrl,
  isMediaDecoded,
  markMediaDecoded,
  scheduleMediaPrefetch,
} from '../utils/media';

interface TripCatalogProps {
  trips: NormalizedTrip[];
  unknownSlug?: string | null;
  onSelectTrip: (slug: string) => void;
  onDismissUnknownSlug?: () => void;
}

const DEFAULT_FALLBACK_COLOR = '#b91c1c';

function resolveTripCoverId(trip: NormalizedTrip): string | undefined {
  if (trip.cover_image) return trip.cover_image;
  for (const day of trip.days) {
    for (const spot of day.spots) {
      if (spot.images && spot.images.length > 0) return spot.images[0];
    }
  }
  return undefined;
}

function getTripStats(trip: NormalizedTrip) {
  const totalDays = trip.days.length;
  const totalSpots = trip.days.reduce((acc, day) => acc + day.spots.length, 0);
  const totalPhotos = trip.days.reduce(
    (acc, day) => acc + day.spots.reduce((sAcc, spot) => sAcc + spot.images.length, 0),
    0
  );
  const calculatedKm = trip.days.reduce(
    (acc, day) => acc + (day.driving_distance_km ?? calculateDayDistance(day.spots)),
    0
  );
  const totalKm = Math.round(trip.total_distance_km ?? calculatedKm);
  const firstDate = trip.days[0]?.date;
  const lastDate = trip.days[trip.days.length - 1]?.date;
  const dateRange =
    firstDate && lastDate
      ? firstDate === lastDate
        ? firstDate
        : `${firstDate} — ${lastDate}`
      : `${totalDays} ${totalDays === 1 ? 'Day' : 'Days'}`;

  return {
    totalDays,
    totalSpots,
    totalPhotos,
    totalKm,
    dateRange,
  };
}

const CatalogCoverImage: React.FC<{
  assetId?: string;
  alt: string;
  monogram: string;
}> = ({ assetId, alt, monogram }) => {
  const url = assetId ? getMediaUrl(assetId, 'grid') : '';
  const [loaded, setLoaded] = useState<boolean>(() => Boolean(url && isMediaDecoded(url)));
  const [showPlaceholder, setShowPlaceholder] = useState<boolean>(
    () => Boolean(url) && !isMediaDecoded(url)
  );

  useEffect(() => {
    if (!url) {
      setLoaded(false);
      setShowPlaceholder(false);
      return;
    }

    if (isMediaDecoded(url)) {
      setLoaded(true);
      setShowPlaceholder(false);
      return;
    }

    let cancelled = false;
    setLoaded(false);
    setShowPlaceholder(false);

    const placeholderTimer = window.setTimeout(() => {
      if (!cancelled) setShowPlaceholder(true);
    }, 90);

    const img = new Image();
    img.src = url;
    const finish = () => {
      if (cancelled) return;
      window.clearTimeout(placeholderTimer);
      markMediaDecoded(url);
      setLoaded(true);
      setShowPlaceholder(false);
    };

    if (typeof img.decode === 'function') {
      img.decode().then(finish).catch(() => {
        img.onload = finish;
      });
    } else {
      img.onload = finish;
    }

    return () => {
      cancelled = true;
      window.clearTimeout(placeholderTimer);
    };
  }, [url]);

  if (!url) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: '#ebe6dc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          color: '#6b6860',
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: '42px',
            lineHeight: 1,
            color: 'rgba(22, 22, 21, 0.35)',
          }}
        >
          {monogram}
        </Typography>
        <Typography
          sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Map Expedition
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        bgcolor: '#e7e2d8',
        overflow: 'hidden',
      }}
    >
      {showPlaceholder && !loaded && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(120deg, rgba(235,230,220,1) 25%, rgba(245,242,235,1) 50%, rgba(235,230,220,1) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}
      <Box
        component="img"
        src={url}
        alt={alt}
        loading="eager"
        decoding="async"
        className="catalog-card-image"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.25s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </Box>
  );
};

export const TripCatalog: React.FC<TripCatalogProps> = ({
  trips,
  unknownSlug,
  onSelectTrip,
  onDismissUnknownSlug,
}) => {
  const isSingleFeatured = trips.length === 1;

  useEffect(() => {
    const coverUrls = trips
      .map(resolveTripCoverId)
      .filter((id): id is string => Boolean(id))
      .map((id) => getMediaUrl(id, 'grid'));
    if (coverUrls.length > 0) {
      scheduleMediaPrefetch(coverUrls);
    }
  }, [trips]);

  return (
    <Box
      sx={{
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        bgcolor: '#f5f2eb',
        color: '#161615',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Sticky Gallery Paper Masthead */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          height: 'var(--header-height)',
          bgcolor: 'rgba(245, 242, 235, 0.94)',
          color: '#161615',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
          justifyContent: 'center',
        }}
      >
        <Toolbar
          variant="dense"
          sx={{
            minHeight: 'var(--header-height)',
            px: { xs: 2, sm: 3.5 },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '4px',
                border: '1px solid rgba(22, 22, 21, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 600,
                color: '#161615',
                bgcolor: 'rgba(255, 255, 255, 0.65)',
              }}
            >
              TS
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontWeight: 400,
                fontSize: { xs: '19px', sm: '22px' },
                lineHeight: 1.1,
                letterSpacing: '0.01em',
                color: '#161615',
              }}
            >
              TripShare
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PublicIcon sx={{ fontSize: 15, color: '#b91c1c' }} />
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6b6860',
              }}
            >
              Archive · {trips.length} {trips.length === 1 ? 'Expedition' : 'Expeditions'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          py: { xs: 4, sm: 6.5 },
          px: { xs: 2, sm: 3.5 },
        }}
      >
        {/* Unknown Slug Banner */}
        {unknownSlug && (
          <Box
            sx={{
              mb: 4,
              px: 2.25,
              py: 1.5,
              bgcolor: '#ffffff',
              border: '1px solid rgba(185, 28, 28, 0.28)',
              borderLeft: '3px solid #b91c1c',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#b91c1c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  mb: 0.25,
                }}
              >
                Route Not Found
              </Typography>
              <Typography sx={{ fontSize: '14px', color: '#161615' }}>
                No expedition matches <code>/{unknownSlug}</code>. Select an available trip below.
              </Typography>
            </Box>
            {onDismissUnknownSlug && (
              <IconButton
                size="small"
                aria-label="Dismiss route notice"
                onClick={onDismissUnknownSlug}
                sx={{ color: '#6b6860', '&:hover': { color: '#161615' } }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}

        {/* Editorial Archive Hero */}
        <Box
          sx={{
            mb: { xs: 4, sm: 5.5 },
            pb: { xs: 3, sm: 4 },
            borderBottom: '1px solid rgba(22, 22, 21, 0.12)',
          }}
        >
          <Typography
            sx={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#b91c1c',
              mb: 1,
            }}
          >
            Expedition Archive
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontWeight: 400,
              fontSize: { xs: '36px', sm: '52px' },
              lineHeight: 1.04,
              color: '#161615',
              mb: 1.5,
            }}
          >
            Field Journals &amp; Routes
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '15px', sm: '16px' },
              lineHeight: 1.6,
              color: '#6b6860',
              maxWidth: '64ch',
            }}
          >
            Select an expedition to open its interactive route map, day-by-day driving logs, and
            curated photography archive.
          </Typography>
        </Box>

        {/* Empty State */}
        {trips.length === 0 ? (
          <Box
            sx={{
              p: 5,
              bgcolor: '#ffffff',
              border: '1px solid rgba(22, 22, 21, 0.12)',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: '28px',
                color: '#161615',
                mb: 1,
              }}
            >
              No Expeditions Available
            </Typography>
            <Typography sx={{ color: '#6b6860', fontSize: '14px' }}>
              Add trip entries to <code>src/data/trips.json</code> or{' '}
              <code>src/data/trips/*.json</code> to populate the archive.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isSingleFeatured
                ? '1fr'
                : { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: { xs: 3, sm: 3.5 },
            }}
          >
            {trips.map((trip, index) => {
              const stats = getTripStats(trip);
              const coverId = resolveTripCoverId(trip);
              const monogram = getTripMonogram(trip.trip);
              const editionLabel = `VOL. ${String(index + 1).padStart(2, '0')}`;
              const dayColors = trip.days.map((d) => d.color || DEFAULT_FALLBACK_COLOR);

              return (
                <Card
                  key={trip.slug}
                  elevation={0}
                  sx={{
                    bgcolor: '#ffffff',
                    border: '1px solid rgba(22, 22, 21, 0.12)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(22, 22, 21, 0.34)',
                      boxShadow: '0 14px 36px rgba(22, 22, 21, 0.08)',
                      transform: 'translateY(-2px)',
                    },
                    '&:hover .catalog-card-image': {
                      transform: 'scale(1.03)',
                    },
                    '&:hover .catalog-cta-arrow': {
                      transform: 'translateX(4px)',
                    },
                  }}
                >
                  <CardActionArea
                    component="a"
                    href={`/${trip.slug}`}
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                        return;
                      }
                      e.preventDefault();
                      onSelectTrip(trip.slug);
                    }}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isSingleFeatured
                        ? { xs: '1fr', md: '1.15fr 1fr' }
                        : '1fr',
                      alignItems: 'stretch',
                      textDecoration: 'none',
                      color: 'inherit',
                      height: '100%',
                    }}
                  >
                    {/* Cover Visual */}
                    <Box
                      sx={{
                        position: 'relative',
                        aspectRatio: isSingleFeatured ? { xs: '16 / 10', md: 'auto' } : '16 / 10',
                        minHeight: isSingleFeatured ? { md: 360 } : undefined,
                        borderBottom: isSingleFeatured
                          ? { xs: '1px solid rgba(22, 22, 21, 0.10)', md: 'none' }
                          : '1px solid rgba(22, 22, 21, 0.10)',
                        borderRight: isSingleFeatured
                          ? { md: '1px solid rgba(22, 22, 21, 0.10)' }
                          : 'none',
                      }}
                    >
                      <CatalogCoverImage assetId={coverId} alt={trip.title} monogram={monogram} />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 14,
                          left: 14,
                          px: 1.1,
                          py: 0.45,
                          borderRadius: '3px',
                          bgcolor: 'rgba(245, 242, 235, 0.92)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(22, 22, 21, 0.14)',
                        }}
                      >
                        <Typography
                          sx={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            color: '#161615',
                          }}
                        >
                          {editionLabel} · /{trip.slug}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Details Sheet */}
                    <Box
                      sx={{
                        p: { xs: 2.5, sm: 3.5 },
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 2.5,
                      }}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            mb: 1.25,
                          }}
                        >
                          <Typography
                            sx={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              color: '#b91c1c',
                            }}
                          >
                            {trip.trip}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px',
                              color: '#6b6860',
                            }}
                          >
                            {stats.dateRange}
                          </Typography>
                        </Box>

                        <Typography
                          variant="h2"
                          sx={{
                            fontFamily: "'Instrument Serif', Georgia, serif",
                            fontWeight: 400,
                            fontSize: isSingleFeatured
                              ? { xs: '28px', sm: '34px' }
                              : { xs: '26px', sm: '30px' },
                            lineHeight: 1.12,
                            color: '#161615',
                            mb: 1.25,
                          }}
                        >
                          {trip.title}
                        </Typography>

                        {trip.description && (
                          <Typography
                            sx={{
                              fontSize: '14px',
                              lineHeight: 1.65,
                              color: '#6b6860',
                              display: '-webkit-box',
                              WebkitLineClamp: isSingleFeatured ? 4 : 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {trip.description}
                          </Typography>
                        )}
                      </Box>

                      <Box>
                        {/* 4-Column Stat Strip */}
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            borderTop: '1px solid rgba(22, 22, 21, 0.10)',
                            borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
                            py: 1.5,
                            mb: 2,
                            gap: 1,
                          }}
                        >
                          {[
                            { label: 'DAYS', value: stats.totalDays },
                            { label: 'STOPS', value: stats.totalSpots },
                            { label: 'PHOTOS', value: stats.totalPhotos },
                            { label: 'KM', value: stats.totalKm },
                          ].map((stat) => (
                            <Box key={stat.label}>
                              <Typography
                                sx={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: '10px',
                                  letterSpacing: '0.08em',
                                  color: '#6b6860',
                                }}
                              >
                                {stat.label}
                              </Typography>
                              <Typography
                                sx={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: '15px',
                                  fontWeight: 600,
                                  color: '#161615',
                                }}
                              >
                                {stat.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>

                        {/* Route Color Bar */}
                        {dayColors.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              gap: '3px',
                              height: 4,
                              mb: 2,
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            {dayColors.map((color, dIdx) => (
                              <Box
                                key={dIdx}
                                sx={{
                                  flex: 1,
                                  bgcolor: color,
                                  opacity: 0.88,
                                }}
                              />
                            ))}
                          </Box>
                        )}

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography
                            sx={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              color: '#b91c1c',
                            }}
                          >
                            Open Overview Map
                          </Typography>
                          <ArrowForwardIcon
                            className="catalog-cta-arrow"
                            sx={{
                              fontSize: 17,
                              color: '#b91c1c',
                              transition: 'transform 0.2s ease',
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        )}
      </Container>
    </Box>
  );
};

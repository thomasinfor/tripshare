import React, { useMemo, useState } from 'react';
import { NormalizedTrip } from '../types';
import { getMediaUrl } from '../utils/media';
import { TripPhotoDraftMap, buildAgentPhotoEditPrompt } from '../utils/photoDrafts';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

interface PhotoDraftReviewModalProps {
  trips: NormalizedTrip[];
  drafts: TripPhotoDraftMap;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onClose: () => void;
  onUndoSingleItem: (draftKey: string, kind: 'add' | 'remove', assetId: string) => void;
  onUndoReorder?: (draftKey: string) => void;
  onResetSpot: (draftKey: string) => void;
  onClearAll: () => void;
  onJumpToSpot?: (tripSlug: string, dayIndex: number, spotIndex: number) => void;
}

function copyTextFallback(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const PhotoDraftReviewModal: React.FC<PhotoDraftReviewModalProps> = ({
  trips,
  drafts,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClose,
  onUndoSingleItem,
  onUndoReorder,
  onResetSpot,
  onClearAll,
  onJumpToSpot,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const { entries, prompt, totalAdded, totalRemoved, totalReordered } = useMemo(
    () => buildAgentPhotoEditPrompt(trips, drafts),
    [trips, drafts]
  );

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    let copied = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(prompt);
        copied = true;
      } catch {
        copied = copyTextFallback(prompt);
      }
    } else {
      copied = copyTextFallback(prompt);
    }

    if (copied) {
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2200);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#f5f2eb',
            border: '1px solid rgba(22, 22, 21, 0.14)',
            borderRadius: { xs: 0, sm: '14px' },
            m: { xs: 0, sm: 2 },
            width: { xs: '100%', sm: 'calc(100% - 32px)' },
            maxWidth: { xs: '100%', sm: '860px' },
            height: { xs: '100dvh', sm: 'auto' },
            maxHeight: { xs: '100dvh', sm: '88dvh' },
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(22, 22, 21, 0.22)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          bgcolor: '#ffffff',
          borderBottom: '1px solid rgba(22, 22, 21, 0.10)',
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <SmartToyOutlinedIcon sx={{ color: '#b91c1c', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontWeight: 400,
                fontSize: { xs: '21px', sm: '25px' },
                color: '#161615',
                lineHeight: 1.1,
              }}
            >
              Staged Photo Edits &amp; AI Agent Prompt
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                color: '#6b6860',
                fontSize: '11px',
              }}
            >
              {entries.length} spot{entries.length === 1 ? '' : 's'} · +{totalAdded} added · −{totalRemoved} removed
              {totalReordered > 0 ? ` · ${totalReordered} reordered` : ''}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {onUndo && (
            <Tooltip title="Undo (Ctrl+Z)" arrow>
              <span>
                <IconButton
                  size="small"
                  aria-label="Undo photo edit"
                  disabled={!canUndo}
                  onClick={onUndo}
                  sx={{
                    color: '#6b6860',
                    '&:hover': { color: '#161615' },
                    '&.Mui-disabled': { opacity: 0.35 },
                  }}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {onRedo && (
            <Tooltip title="Redo (Ctrl+Shift+Z)" arrow>
              <span>
                <IconButton
                  size="small"
                  aria-label="Redo photo edit"
                  disabled={!canRedo}
                  onClick={onRedo}
                  sx={{
                    color: '#6b6860',
                    '&:hover': { color: '#161615' },
                    '&.Mui-disabled': { opacity: 0.35 },
                  }}
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: '#6b6860', '&:hover': { color: '#161615' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          p: { xs: 2, sm: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {entries.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid rgba(22, 22, 21, 0.10)',
            }}
          >
            <Typography sx={{ color: '#161615', fontWeight: 600, mb: 0.75 }}>
              No photo changes staged yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b6860' }}>
              Enable Edit Photos mode on any spot to paste Immich photo URLs/UUIDs or mark photos for removal.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Per-Spot Visual Staging List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {entries.map((entry) => (
                <Box
                  key={entry.key}
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(22, 22, 21, 0.10)',
                    p: { xs: 1.5, sm: 2 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.25,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        sx={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '10.5px',
                          color: '#6b6860',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                        }}
                      >
                        /{entry.tripSlug} · Day {entry.dayNumber} · Spot {entry.spotNumber} ({entry.spotId})
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#161615' }} noWrap>
                        {entry.spotName}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                      {onJumpToSpot && (
                        <Button
                          size="small"
                          onClick={() => {
                            onJumpToSpot(entry.tripSlug, entry.dayIndex, entry.spotIndex);
                            onClose();
                          }}
                          endIcon={<OpenInNewIcon sx={{ fontSize: '13px !important' }} />}
                          sx={{
                            fontSize: '11px',
                            fontFamily: "'JetBrains Mono', monospace",
                            color: '#161615',
                            borderColor: 'rgba(22, 22, 21, 0.14)',
                          }}
                          variant="outlined"
                        >
                          View
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={() => onResetSpot(entry.key)}
                        sx={{
                          fontSize: '11px',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#6b6860',
                        }}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Box>

                  {/* Asset Thumbnail Chips */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {entry.addedIds.map((assetId) => (
                      <Box
                        key={`add-${assetId}`}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 0.6,
                          pr: 0.75,
                          borderRadius: '6px',
                          bgcolor: 'rgba(21, 128, 61, 0.08)',
                          border: '1px solid rgba(21, 128, 61, 0.28)',
                        }}
                      >
                        <Box
                          component="img"
                          src={getMediaUrl(assetId, 'thumbnail')}
                          alt={assetId}
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '4px',
                            objectFit: 'cover',
                            bgcolor: '#ebe6dc',
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Chip
                            label="+ ADD"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '9.5px',
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              bgcolor: '#15803d',
                              color: '#ffffff',
                              mb: 0.3,
                            }}
                          />
                          <Typography
                            sx={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '10.5px',
                              color: '#161615',
                            }}
                          >
                            {assetId.slice(0, 8)}…
                          </Typography>
                        </Box>
                        <Tooltip title="Remove from draft">
                          <IconButton
                            size="small"
                            aria-label={`Undo add ${assetId}`}
                            onClick={() => onUndoSingleItem(entry.key, 'add', assetId)}
                            sx={{ color: '#15803d', p: 0.35 }}
                          >
                            <CloseIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}

                    {entry.removedIds.map((assetId) => (
                      <Box
                        key={`rem-${assetId}`}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 0.6,
                          pr: 0.75,
                          borderRadius: '6px',
                          bgcolor: 'rgba(185, 28, 28, 0.06)',
                          border: '1px solid rgba(185, 28, 28, 0.28)',
                        }}
                      >
                        <Box
                          component="img"
                          src={getMediaUrl(assetId, 'thumbnail')}
                          alt={assetId}
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '4px',
                            objectFit: 'cover',
                            bgcolor: '#ebe6dc',
                            opacity: 0.65,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Chip
                            label="− REMOVE"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '9.5px',
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              bgcolor: '#b91c1c',
                              color: '#ffffff',
                              mb: 0.3,
                            }}
                          />
                          <Typography
                            sx={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '10.5px',
                              color: '#161615',
                            }}
                          >
                            {assetId.slice(0, 8)}…
                          </Typography>
                        </Box>
                        <Tooltip title="Keep photo (undo remove)">
                          <IconButton
                            size="small"
                            aria-label={`Undo remove ${assetId}`}
                            onClick={() => onUndoSingleItem(entry.key, 'remove', assetId)}
                            sx={{ color: '#b91c1c', p: 0.35 }}
                          >
                            <CloseIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>

                  {entry.isReordered && entry.orderedIds && (
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: '6px',
                        bgcolor: 'rgba(22, 22, 21, 0.035)',
                        border: '1px solid rgba(22, 22, 21, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.9,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Chip
                          label={`⇄ REORDERED (${entry.orderedIds.length} photos)`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            bgcolor: '#161615',
                            color: '#f5f2eb',
                          }}
                        />
                        {onUndoReorder && (
                          <Button
                            size="small"
                            onClick={() => onUndoReorder(entry.key)}
                            sx={{
                              py: 0.15,
                              px: 0.9,
                              fontSize: '10.5px',
                              fontFamily: "'JetBrains Mono', monospace",
                              color: '#6b6860',
                            }}
                          >
                            Undo Order
                          </Button>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflowX: 'auto', pb: 0.25 }}>
                        {entry.orderedIds.map((assetId, ordIdx) => (
                          <Box
                            key={`ord-${assetId}-${ordIdx}`}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 0.25,
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              component="img"
                              src={getMediaUrl(assetId, 'thumbnail')}
                              alt={`Position ${ordIdx + 1}`}
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '4px',
                                objectFit: 'cover',
                                bgcolor: '#ebe6dc',
                                border: ordIdx === 0 ? '1.5px solid #b91c1c' : '1px solid rgba(22, 22, 21, 0.12)',
                              }}
                            />
                            <Typography
                              sx={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '9.5px',
                                fontWeight: ordIdx === 0 ? 700 : 500,
                                color: ordIdx === 0 ? '#b91c1c' : '#6b6860',
                              }}
                            >
                              #{ordIdx + 1}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>

            {/* Generated AI Agent Prompt Box */}
            <Box
              sx={{
                bgcolor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid rgba(22, 22, 21, 0.12)',
                p: { xs: 1.5, sm: 2 },
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#161615',
                  }}
                >
                  Prompt to Paste into AI Agent Chat
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCopyPrompt}
                  startIcon={copiedPrompt ? <CheckIcon /> : <ContentCopyIcon />}
                  sx={{
                    bgcolor: copiedPrompt ? '#15803d' : '#161615',
                    color: '#f5f2eb',
                    borderRadius: '999px',
                    px: 1.75,
                    fontSize: '12px',
                    '&:hover': { bgcolor: copiedPrompt ? '#166534' : '#2c2c2a' },
                  }}
                >
                  {copiedPrompt ? 'Copied Prompt!' : 'Copy Prompt'}
                </Button>
              </Box>

              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  borderRadius: '6px',
                  bgcolor: '#f5f2eb',
                  border: '1px solid rgba(22, 22, 21, 0.10)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11.5px',
                  lineHeight: 1.5,
                  color: '#161615',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 220,
                  overflowY: 'auto',
                  userSelect: 'all',
                }}
              >
                {prompt}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          bgcolor: '#ffffff',
          borderTop: '1px solid rgba(22, 22, 21, 0.10)',
          px: { xs: 2, sm: 3 },
          pt: 1.5,
          pb: { xs: 'calc(12px + env(safe-area-inset-bottom, 0px))', sm: 1.75 },
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          {entries.length > 0 && (
            <Button
              size="small"
              color="error"
              variant={confirmClearAll ? 'contained' : 'text'}
              startIcon={<DeleteSweepIcon />}
              onClick={() => {
                if (!confirmClearAll) {
                  setConfirmClearAll(true);
                  return;
                }
                onClearAll();
                setConfirmClearAll(false);
              }}
              sx={{ fontSize: '12px', borderRadius: '999px' }}
            >
              {confirmClearAll ? 'Confirm Clear All Drafts' : 'Clear All Drafts'}
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="outlined" onClick={onClose} sx={{ borderRadius: '999px' }}>
            Close
          </Button>
          {entries.length > 0 && (
            <Button
              variant="contained"
              onClick={handleCopyPrompt}
              startIcon={copiedPrompt ? <CheckIcon /> : <ContentCopyIcon />}
              sx={{
                bgcolor: copiedPrompt ? '#15803d' : '#161615',
                color: '#f5f2eb',
                borderRadius: '999px',
                '&:hover': { bgcolor: copiedPrompt ? '#166534' : '#2c2c2a' },
              }}
            >
              {copiedPrompt ? 'Copied!' : 'Copy Prompt for AI Agent'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

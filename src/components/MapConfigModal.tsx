import React, { useState } from 'react';
import { MapStyle } from '../types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  FormLabel,
  Typography,
  Box,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Checkbox,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import LayersIcon from '@mui/icons-material/Layers';

interface MapConfigModalProps {
  mapStyle: MapStyle;
  showAllDayRoute: boolean;
  onClose: () => void;
  onSave: (config: {
    mapStyle: MapStyle;
    showAllDayRoute: boolean;
  }) => void;
}

export const MapConfigModal: React.FC<MapConfigModalProps> = ({
  mapStyle: initialStyle,
  showAllDayRoute: initialShowAll,
  onClose,
  onSave,
}) => {
  const [mapStyle, setMapStyle] = useState<MapStyle>(initialStyle);
  const [showAllDayRoute, setShowAllDayRoute] = useState(initialShowAll);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      mapStyle,
      showAllDayRoute,
    });
    onClose();
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#ffffff',
            border: '1px solid rgba(22, 22, 21, 0.12)',
            borderRadius: '16px',
            boxShadow: '0 25px 60px rgba(22, 22, 21, 0.22)',
            m: { xs: 1.5, sm: 3 },
            width: { xs: 'calc(100% - 24px)', sm: '100%' },
            maxHeight: 'calc(100dvh - 24px)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(22, 22, 21, 0.09)',
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <PublicIcon sx={{ color: '#b91c1c', flexShrink: 0 }} />
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontWeight: 400,
              fontSize: { xs: '20px', sm: '24px' },
              color: '#161615',
            }}
          >
            Map Display Settings
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#6b6860', '&:hover': { color: '#161615' }, flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
          {/* Map Style Theme */}
          <Box>
            <FormLabel
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                color: '#6b6860',
                fontWeight: 600,
                fontSize: 11.5,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                mb: 1,
                display: 'block',
              }}
            >
              Map Theme Style
            </FormLabel>
            <ToggleButtonGroup
              value={mapStyle}
              exclusive
              onChange={(_, next) => next && setMapStyle(next)}
              fullWidth
              size="small"
            >
              {(['streets', 'satellite', 'dark'] as MapStyle[]).map((style) => (
                <ToggleButton
                  key={style}
                  value={style}
                  sx={{
                    color: '#6b6860',
                    borderColor: 'rgba(22, 22, 21, 0.14)',
                    py: 1,
                    px: { xs: 0.75, sm: 1.5 },
                    fontSize: { xs: '12px', sm: '13px' },
                    textTransform: 'capitalize',
                    '&.Mui-selected': {
                      color: '#f5f2eb',
                      bgcolor: '#161615',
                      '&:hover': { bgcolor: '#2c2c2a' },
                    },
                  }}
                >
                  <LayersIcon sx={{ fontSize: 16, mr: 0.75 }} />
                  {style}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Route Display Option */}
          <FormControlLabel
            control={
              <Checkbox
                checked={showAllDayRoute}
                onChange={(e) => setShowAllDayRoute(e.target.checked)}
                sx={{ color: '#6b6860', '&.Mui-checked': { color: '#161615' } }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: '#4a4842' }}>
                Draw background guide line for the entire day's route
              </Typography>
            }
          />
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2.25 }, borderTop: '1px solid rgba(22, 22, 21, 0.09)', gap: 1 }}>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Save Settings
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

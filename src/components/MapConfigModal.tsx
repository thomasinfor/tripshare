import React, { useState } from 'react';
import { MapProvider, MapStyle } from '../types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  TextField,
  Typography,
  Box,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Checkbox,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import KeyIcon from '@mui/icons-material/Key';
import LayersIcon from '@mui/icons-material/Layers';

interface MapConfigModalProps {
  provider: MapProvider;
  mapStyle: MapStyle;
  googleApiKey: string;
  showAllDayRoute: boolean;
  onClose: () => void;
  onSave: (config: {
    provider: MapProvider;
    mapStyle: MapStyle;
    googleApiKey: string;
    showAllDayRoute: boolean;
  }) => void;
}

export const MapConfigModal: React.FC<MapConfigModalProps> = ({
  provider: initialProvider,
  mapStyle: initialStyle,
  googleApiKey: initialKey,
  showAllDayRoute: initialShowAll,
  onClose,
  onSave,
}) => {
  const [provider, setProvider] = useState<MapProvider>(initialProvider);
  const [mapStyle, setMapStyle] = useState<MapStyle>(initialStyle);
  const [apiKey, setApiKey] = useState(initialKey);
  const [showAllDayRoute, setShowAllDayRoute] = useState(initialShowAll);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      mapStyle,
      googleApiKey: apiKey.trim(),
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
          pb: 1.75,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <PublicIcon sx={{ color: '#b91c1c' }} />
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontWeight: 400,
              fontSize: '24px',
              color: '#161615',
            }}
          >
            Map Settings & Configuration
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#6b6860', '&:hover': { color: '#161615' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 3 }}>
          {/* Map Engine Provider */}
          <FormControl component="fieldset">
            <FormLabel
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                color: '#6b6860',
                fontWeight: 600,
                fontSize: 11.5,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                mb: 1,
              }}
            >
              Map Engine Provider
            </FormLabel>
            <RadioGroup
              value={provider}
              onChange={(e) => setProvider(e.target.value as MapProvider)}
              sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
            >
              <Box
                onClick={() => setProvider('leaflet')}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: provider === 'leaflet' ? 'rgba(22, 22, 21, 0.05)' : '#f9f7f2',
                  border: '1px solid',
                  borderColor: provider === 'leaflet' ? '#161615' : 'rgba(22, 22, 21, 0.10)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Radio checked={provider === 'leaflet'} sx={{ p: 0.5, mr: 1, color: '#161615', '&.Mui-checked': { color: '#161615' } }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#161615', fontWeight: 700 }}>
                    OpenStreetMap / Leaflet
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b6860' }}>
                    Free open-source map tiles. Includes Streets, Satellite, and Dark modes.
                  </Typography>
                </Box>
              </Box>

              <Box
                onClick={() => setProvider('google')}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: provider === 'google' ? 'rgba(22, 22, 21, 0.05)' : '#f9f7f2',
                  border: '1px solid',
                  borderColor: provider === 'google' ? '#161615' : 'rgba(22, 22, 21, 0.10)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Radio checked={provider === 'google'} sx={{ p: 0.5, mr: 1, color: '#161615', '&.Mui-checked': { color: '#161615' } }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#161615', fontWeight: 700 }}>
                    Google Maps (@vis.gl)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b6860' }}>
                    Google Maps JavaScript API. Uses API key from environment (.env.local) or custom key below.
                  </Typography>
                </Box>
              </Box>
            </RadioGroup>
          </FormControl>

          {/* Google API Key input */}
          {provider === 'google' && (
            <TextField
              label="Google Maps JavaScript API Key"
              variant="outlined"
              size="small"
              fullWidth
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 18, color: '#6b6860' }} />
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Configured in .env.local via VITE_GOOGLE_MAPS_API_KEY or overridden here."
            />
          )}

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

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(22, 22, 21, 0.09)', gap: 1 }}>
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

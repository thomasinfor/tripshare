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
import MapIcon from '@mui/icons-material/Map';

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
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 3,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PublicIcon sx={{ color: '#38bdf8' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
            Map Settings & Configuration
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', '&:hover': { color: '#fff' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 3 }}>
          {/* Map Engine Provider */}
          <FormControl component="fieldset">
            <FormLabel sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 13, mb: 1 }}>
              Map Engine Provider
            </FormLabel>
            <RadioGroup
              value={provider}
              onChange={(e) => setProvider(e.target.value as MapProvider)}
              sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
            >
              <Box
                onClick={() => setProvider('leaflet')}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: provider === 'leaflet' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid',
                  borderColor: provider === 'leaflet' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Radio checked={provider === 'leaflet'} sx={{ p: 0.5, mr: 1, color: '#38bdf8' }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>
                    OpenStreetMap / Leaflet (Recommended)
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Instant, free, no API key needed. Includes Dark, Satellite, and Streets tiles.
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
                  bgcolor: provider === 'google' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid',
                  borderColor: provider === 'google' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Radio checked={provider === 'google'} sx={{ p: 0.5, mr: 1, color: '#38bdf8' }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>
                    Google Maps (@vis.gl)
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
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
                      <KeyIcon sx={{ fontSize: 18, color: '#38bdf8' }} />
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Configured in .env.local via VITE_GOOGLE_MAPS_API_KEY or overridden here."
            />
          )}

          {/* Map Style Theme */}
          <Box>
            <FormLabel sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 13, mb: 1, display: 'block' }}>
              Map Theme Style
            </FormLabel>
            <ToggleButtonGroup
              value={mapStyle}
              exclusive
              onChange={(_, next) => next && setMapStyle(next)}
              fullWidth
              size="small"
            >
              {(['dark', 'satellite', 'streets'] as MapStyle[]).map((style) => (
                <ToggleButton
                  key={style}
                  value={style}
                  sx={{
                    color: 'text.secondary',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    py: 1,
                    textTransform: 'capitalize',
                    '&.Mui-selected': {
                      color: '#38bdf8',
                      bgcolor: 'rgba(56, 189, 248, 0.15)',
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
                sx={{ color: '#38bdf8' }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                Draw background guide line for the entire day's route
              </Typography>
            }
          />
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)', gap: 1 }}>
          <Button variant="outlined" onClick={onClose} sx={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}>
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

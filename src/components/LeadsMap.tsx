import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon, LatLngBounds } from 'leaflet';
import { Lead } from '@/types/lead';
import { MapPin, Phone, Globe, Star } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix para ícones do Leaflet no Vite
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface LeadsMapProps {
  leads: Lead[];
}

export function LeadsMap({ leads }: LeadsMapProps) {
  // Filtrar leads que têm coordenadas
  const leadsWithCoords = useMemo(() => {
    return leads.filter(lead => {
      const serpData = (lead as any).serpData;
      return serpData?.latitude && serpData?.longitude;
    });
  }, [leads]);

  // Calcular centro e bounds do mapa
  const { center, bounds } = useMemo(() => {
    if (leadsWithCoords.length === 0) {
      // Centro do Brasil como fallback
      return { 
        center: [-15.7801, -47.9292] as [number, number],
        bounds: null 
      };
    }

    const coords = leadsWithCoords.map(lead => {
      const serpData = (lead as any).serpData;
      return [serpData.latitude, serpData.longitude] as [number, number];
    });

    // Calcular centro médio
    const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

    // Criar bounds para ajustar zoom
    const latLngs = coords.map(c => ({ lat: c[0], lng: c[1] }));
    const leafletBounds = new LatLngBounds(latLngs);

    return { 
      center: [avgLat, avgLng] as [number, number],
      bounds: leafletBounds
    };
  }, [leadsWithCoords]);

  if (leadsWithCoords.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-muted/30 rounded-lg border">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum lead com localização disponível</p>
          <p className="text-sm">Os leads precisam ter coordenadas do Google Maps</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-[1000] bg-background/90 backdrop-blur px-3 py-1.5 rounded-md text-sm font-medium shadow-sm">
        {leadsWithCoords.length} leads no mapa
      </div>
      
      <MapContainer
        center={center}
        zoom={12}
        bounds={bounds || undefined}
        className="h-[500px] w-full rounded-lg border shadow-sm"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {leadsWithCoords.map((lead) => {
          const serpData = (lead as any).serpData;
          return (
            <Marker
              key={lead.id}
              position={[serpData.latitude, serpData.longitude]}
              icon={defaultIcon}
            >
              <Popup>
                <div className="min-w-[200px] space-y-2">
                  <h3 className="font-semibold text-base">{lead.company}</h3>
                  
                  {serpData.address && (
                    <p className="text-sm text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-1 flex-shrink-0" />
                      {serpData.address}
                    </p>
                  )}
                  
                  {lead.phone && (
                    <p className="text-sm flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                        {serpData.phoneFormatted || lead.phone}
                      </a>
                    </p>
                  )}
                  
                  {lead.website && (
                    <p className="text-sm flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <a 
                        href={lead.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate max-w-[180px]"
                      >
                        {new URL(lead.website).hostname}
                      </a>
                    </p>
                  )}
                  
                  {serpData.rating && (
                    <p className="text-sm flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      {serpData.rating} ({serpData.ratingCount || 0} avaliações)
                    </p>
                  )}
                  
                  {serpData.category && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {serpData.category}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

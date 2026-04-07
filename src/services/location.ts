import Geolocation from '@react-native-community/geolocation';

const NOMINATIM_HEADERS = {
  'User-Agent': 'SunriseAlarmRN/1.0 (com.sunrisealarmrn)',
  'Accept': 'application/json',
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  city?: string;
  cep?: string;
  state?: string;
  uf?: string;
  coordinates: Coordinates;
}

// Get coordinates from city name using Nominatim
export async function getLocationFromCity(city: string): Promise<LocationResult> {
  return getLocationFromQuery({ city });
}

// Flexible location search — accepts partial combinations
export async function getLocationFromQuery(params: {
  state?: string;
  city?: string;
}): Promise<LocationResult> {
  const { state, city } = params;

  // Build query from most specific to least specific
  const queryParts: string[] = [];
  if (city) queryParts.push(`city=${encodeURIComponent(city)}`);
  if (state) queryParts.push(`state=${encodeURIComponent(state)}`);
  queryParts.push('country=Brazil');

  const queryString = queryParts.join('&');

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${queryString}&format=json&limit=1`,
    { headers: NOMINATIM_HEADERS },
  );

  if (!response.ok) {
    throw new Error('Falha ao buscar localização');
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    throw new Error(city ? 'Cidade não encontrada' : 'Estado não encontrado');
  }

  return {
    city: city || undefined,
    state: state || undefined,
    coordinates: {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    },
  };
}

// Get coordinates from CEP using ViaCEP + Nominatim
export async function getLocationFromCep(cep: string): Promise<LocationResult> {
  const cleanCep = cep.replace(/\D/g, '');

  if (cleanCep.length !== 8) {
    throw new Error('CEP inválido');
  }

  const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

  if (!response.ok) {
    throw new Error('Falha ao buscar CEP');
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error('CEP não encontrado');
  }

  // Use city from CEP to get coordinates
  const locationResult = await getLocationFromCity(data.localidade);

  return {
    ...locationResult,
    cep: cleanCep,
    city: data.localidade,
    uf: data.uf,
  };
}

// Map of Brazilian state codes to full names
const stateMap: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
  'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO'
};

// Get device location using native geolocation
export async function getDeviceLocation(): Promise<LocationResult> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // Reverse geocode to get city name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json`,
            { headers: NOMINATIM_HEADERS },
          );
          const data = await response.json();

          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
          const state = data.address?.state;
          const uf = state ? stateMap[state] : undefined;

          resolve({
            city,
            state,
            uf,
            coordinates,
          });
        } catch {
          resolve({ coordinates });
        }
      },
      () => {
        reject(new Error('Permissão de localização negada ou indisponível'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}

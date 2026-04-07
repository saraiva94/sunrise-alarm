import { Coordinates } from './location';

export interface SunriseData {
  sunrise: Date;
  sunset: Date;
}

export async function getSunrise(coordinates: Coordinates): Promise<SunriseData> {
  const { latitude, longitude } = coordinates;

  const response = await fetch(
    `https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&formatted=0`
  );

  if (!response.ok) {
    throw new Error('Falha ao buscar horário do nascer do sol');
  }

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error('Erro na API do nascer do sol');
  }

  return {
    sunrise: new Date(data.results.sunrise),
    sunset: new Date(data.results.sunset),
  };
}

export function calculateFinalAlarmTime(sunriseTime: Date, anticipation: number): Date {
  const alarmTime = new Date(sunriseTime);
  alarmTime.setMinutes(alarmTime.getMinutes() - anticipation);
  return alarmTime;
}

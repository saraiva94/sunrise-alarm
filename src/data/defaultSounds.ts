// Default alarm sounds for all users - 6 most popular types
// Local files stored in android/app/src/main/res/raw/
export const DEFAULT_ALARM_SOUNDS = [
  {
    id: 'birds',
    name: 'Pássaros Cantando',
    url: 'https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3',
    icon: '🐦',
    isLocal: false,
  },
  {
    id: 'rooster',
    name: 'Galo Cantando',
    url: '',
    icon: '🐓',
    isLocal: true,
    localFile: 'rooster.mp4',
  },
  {
    id: 'clock',
    name: 'Relógio Clássico',
    url: '',
    icon: '⏰',
    isLocal: true,
    localFile: 'clock.mp4',
  },
  {
    id: 'bell',
    name: 'Sino Suave',
    url: '',
    icon: '🔔',
    isLocal: true,
    localFile: 'bell.webm',
  },
  {
    id: 'nature',
    name: 'Natureza Relaxante',
    url: '',
    icon: '🌿',
    isLocal: true,
    localFile: 'nature.mp4',
  },
  {
    id: 'harp',
    name: 'Harpa Celestial',
    url: '',
    icon: '🎵',
    isLocal: true,
    localFile: 'harp.mp4',
  },
];

export function getDefaultSoundById(id: string) {
  return DEFAULT_ALARM_SOUNDS.find(sound => sound.id === id);
}

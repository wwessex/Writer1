import type { Chapter, NarrativeWeatherPoint, NarrativeClimateBand } from '@/types';
import styles from './Inspector.module.css';

interface InspectorWeatherProps {
  narrativeWeather: { points: NarrativeWeatherPoint[]; climateBands: NarrativeClimateBand[] };
  weatherFocusPoint: NarrativeWeatherPoint | null;
  activeChapter: Chapter;
  setHoveredWeatherChapterId: (id: string | null) => void;
  setActiveChapter: (id: string) => void;
}

export function InspectorWeather({
  narrativeWeather,
  weatherFocusPoint,
  activeChapter,
  setHoveredWeatherChapterId,
  setActiveChapter,
}: InspectorWeatherProps) {
  return (
    <div
      className={styles.section}
      role="tabpanel"
      id="inspector-panel-weather"
      aria-labelledby="inspector-tab-weather"
    >
      <div className={styles.weatherBandGrid}>
        {narrativeWeather.climateBands.map(band => (
          <div key={band.id} className={styles.weatherBand}>
            <span className={styles.weatherBand__label}>{band.id}</span>
            <strong>{band.average}</strong>
            <span>{band.label}</span>
          </div>
        ))}
      </div>

      {weatherFocusPoint && (
        <div className={styles.weatherDetails}>
          <strong>{weatherFocusPoint.chapterTitle}</strong>
          <span>Sentiment: {weatherFocusPoint.sentimentProxy}</span>
          <span>Pacing: {weatherFocusPoint.pacingIntensity}</span>
          <span>Dialogue: {weatherFocusPoint.dialogueDensity}%</span>
        </div>
      )}

      <div className={styles.weatherTimeline}>
        {narrativeWeather.points.map((point) => {
          const isActivePoint = point.chapterId === activeChapter?.id;
          const weatherScore = Math.round((Math.abs(point.sentimentProxy) + point.pacingIntensity + point.dialogueDensity) / 3);
          return (
            <button
              key={point.chapterId}
              type="button"
              className={`${styles.weatherPoint} ${isActivePoint ? styles['weatherPoint--active'] : ''}`}
              onMouseEnter={() => setHoveredWeatherChapterId(point.chapterId)}
              onMouseLeave={() => setHoveredWeatherChapterId(null)}
              onFocus={() => setHoveredWeatherChapterId(point.chapterId)}
              onBlur={() => setHoveredWeatherChapterId(null)}
              onClick={() => setActiveChapter(point.chapterId)}
              title={`${point.chapterTitle}
Sentiment ${point.sentimentProxy} | Pacing ${point.pacingIntensity} | Dialogue ${point.dialogueDensity}%`}
            >
              <span className={styles.weatherPoint__label}>{point.chapterOrder + 1}. {point.chapterTitle}</span>
              <div className={styles.weatherPoint__track}>
                <div className={styles.weatherPoint__fill} style={{ width: `${weatherScore}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

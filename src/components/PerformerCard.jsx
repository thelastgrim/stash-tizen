/**
 * PerformerCard — Cover image + name + scene count
 * Cover is portrait-oriented (3:4) — matches Stash's image_path.
 */

import React, { useState } from 'react';
import { useFocusable } from '../hooks/useFocusable.js';
import styles from './PerformerCard.module.css';

export default function PerformerCard({ performer, index, onSelect }) {
  const [imgError, setImgError] = useState(false);

  const { ref, focused } = useFocusable({
    id: `performer-${performer.id}`,
    zone: 'grid',
    onEnter: () => onSelect?.(performer),
    autoFocus: index === 0,
  });

  const initials = performer.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <button
      ref={ref}
      className={`${styles.card} ${focused ? styles.focused : ''}`}
      onClick={() => onSelect?.(performer)}
      aria-label={`${performer.name}, ${performer.scene_count} scenes`}
    >
      <div className={styles.cover}>
        {!imgError && performer.image_path ? (
          <img
            src={performer.image_path}
            alt=""
            className={styles.img}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className={styles.imgFallback}>
            <span>{initials}</span>
          </div>
        )}

        {performer.favorite && (
          <div className={styles.favorite} aria-label="Favorite">★</div>
        )}

        <div className={styles.coverGradient} />

        <div className={styles.coverInfo}>
          <p className={styles.name}>{performer.name}</p>
          <div className={styles.meta}>
            <span className={styles.sceneCount}>{performer.scene_count} scenes</span>
            {performer.rating && (
              <span className={styles.rating}>★ {performer.rating}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

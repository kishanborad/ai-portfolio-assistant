import { useEffect } from 'react';

export type AvatarState = 'greeting' | 'idle' | 'thinking' | 'speaking';

interface AvatarProps {
  state?: AvatarState;
  sizeClass: string;
  animated?: boolean;
  onGreetingDone?: () => void;
}

const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';

const VARIANT_COUNT = 6;
const VARIANT_STORAGE_KEY = 'assistant-avatar-variant';

/**
 * One avatar variant per visitor, picked once and kept: variant 0 is the
 * original doodle, variants 1 to 5 are the alternate doodles. The pick is
 * cached per page load so every avatar on the page shows the same face.
 */
let cachedVariant: number | null = null;

function getAvatarVariant(): number {
  if (cachedVariant !== null) return cachedVariant;
  let variant = 0;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(VARIANT_STORAGE_KEY);
      const parsed = stored === null ? NaN : Number(stored);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < VARIANT_COUNT) {
        variant = parsed;
      } else {
        variant = Math.floor(Math.random() * VARIANT_COUNT);
        window.localStorage.setItem(VARIANT_STORAGE_KEY, String(variant));
      }
    }
  } catch {
    variant = 0;
  }
  cachedVariant = variant;
  return variant;
}

function stillFor(variant: number): string {
  return variant === 0 ? `${base}avatar/doodle.webp` : `${base}avatar/v${variant}/doodle.webp`;
}

function idleVideoFor(variant: number): string {
  return variant === 0 ? `${base}avatar/idle.mp4` : `${base}avatar/v${variant}/idle.mp4`;
}

const ORIGINAL_VIDEOS: Record<AvatarState, string> = {
  greeting: `${base}avatar/greeting.mp4`,
  idle: `${base}avatar/idle.mp4`,
  thinking: `${base}avatar/thinking.mp4`,
  speaking: `${base}avatar/speaking.mp4`,
};

/**
 * Doodle avatar of Kishan, in the visitor's assigned variant. Animated
 * spots swap the looping video by state, the way a status avatar swaps
 * layers: greeting once on load, idle while waiting, thinking while a
 * question is being answered, speaking briefly after an answer lands.
 * The original variant plays a video for every state. Variants 1 to 5
 * play their idle video while waiting and show the variant still with
 * a gentle motion class for the brief greeting, thinking, and speaking
 * states. Still spots and reduced-motion visitors get the still image.
 */
export function Avatar({ state = 'idle', sizeClass, animated = true, onGreetingDone }: AvatarProps) {
  const variant = getAvatarVariant();
  const still = stillFor(variant);
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = `relative shrink-0 overflow-hidden rounded-full shadow-glow ${sizeClass}`;
  const stillMotion = variant !== 0 && state !== 'idle';

  // Variants 1 to 5 greet with a still image, so no video ends to signal
  // the greeting is over. Retire the greeting state on a timer instead.
  useEffect(() => {
    if (!stillMotion || state !== 'greeting' || !onGreetingDone) return;
    const timer = window.setTimeout(onGreetingDone, 2500);
    return () => window.clearTimeout(timer);
  }, [stillMotion, state, onGreetingDone]);

  if (!animated || reducedMotion) {
    return (
      <div className={frame} role="img" aria-label="Doodle avatar of Kishan">
        <img src={still} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (stillMotion) {
    const motionClass =
      state === 'greeting' ? 'avatar-greet' : state === 'thinking' ? 'avatar-sway' : 'avatar-bob';
    return (
      <div className={frame} role="img" aria-label="Doodle avatar of Kishan">
        <img
          key={state}
          src={still}
          alt=""
          className={`h-full w-full object-cover ${motionClass}`}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className={frame} role="img" aria-label="Doodle avatar of Kishan">
      <video
        key={`${variant}-${state}`}
        className="absolute inset-0 h-full w-full object-cover"
        src={variant === 0 ? ORIGINAL_VIDEOS[state] : idleVideoFor(variant)}
        poster={still}
        autoPlay
        muted
        playsInline
        loop={state !== 'greeting'}
        aria-hidden="true"
        onEnded={state === 'greeting' ? onGreetingDone : undefined}
      />
    </div>
  );
}

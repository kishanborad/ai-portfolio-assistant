export type AvatarState = 'greeting' | 'idle' | 'thinking' | 'speaking';

interface AvatarProps {
  state?: AvatarState;
  sizeClass: string;
  animated?: boolean;
  onGreetingDone?: () => void;
}

const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
const STILL = `${base}avatar/doodle.webp`;
const VIDEOS: Record<AvatarState, string> = {
  greeting: `${base}avatar/greeting.mp4`,
  idle: `${base}avatar/idle.mp4`,
  thinking: `${base}avatar/thinking.mp4`,
  speaking: `${base}avatar/speaking.mp4`,
};

/**
 * Doodle avatar of Kishan. Animated spots swap the looping video by state,
 * the way a status avatar swaps layers: greeting once on load, idle while
 * waiting, thinking while a question is being answered, speaking briefly
 * after an answer lands. Still spots and reduced-motion visitors get the
 * single doodle image instead of video.
 */
export function Avatar({ state = 'idle', sizeClass, animated = true, onGreetingDone }: AvatarProps) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = `relative shrink-0 overflow-hidden rounded-full shadow-glow ${sizeClass}`;

  if (!animated || reducedMotion) {
    return (
      <div className={frame} role="img" aria-label="Doodle avatar of Kishan">
        <img src={STILL} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={frame} role="img" aria-label="Doodle avatar of Kishan">
      <video
        key={state}
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEOS[state]}
        poster={STILL}
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

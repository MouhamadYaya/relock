import React from 'react'
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

// Logos de marque exacts (repris de la maquette), rendus en SVG.
export type AppId =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'snapchat'
  | 'reddit'
  | 'x'

const TIKTOK_PATH =
  'M31 12c.5 3 2.6 5.2 5.5 5.6v3.6c-1.9.1-3.7-.4-5.4-1.4v7.9c0 4.6-3.4 7.9-7.8 7.9-4.2 0-7.4-3.2-7.4-7.2 0-4.1 3.3-7.2 7.6-6.9v3.8c-.5-.1-1-.2-1.5-.2-1.9 0-3.4 1.5-3.4 3.4 0 2 1.5 3.5 3.4 3.5 2 0 3.6-1.5 3.6-3.9V12H31z'

export function AppLogo({ app, size = 40 }: { app: AppId; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {app === 'tiktok' && (
        <>
          <Rect width={48} height={48} rx={12} fill="#010101" />
          <Path
            d={TIKTOK_PATH}
            fill="#25F4EE"
            translateX={-1.2}
            translateY={-1.2}
          />
          <Path
            d={TIKTOK_PATH}
            fill="#FE2C55"
            translateX={1.2}
            translateY={1.2}
          />
          <Path d={TIKTOK_PATH} fill="#fff" />
        </>
      )}

      {app === 'instagram' && (
        <>
          <Defs>
            <RadialGradient id="igGrad" cx="0.3" cy="1.07" r="1.3">
              <Stop offset="0" stopColor="#FED576" />
              <Stop offset="0.26" stopColor="#F47133" />
              <Stop offset="0.61" stopColor="#BC3081" />
              <Stop offset="1" stopColor="#4C63D2" />
            </RadialGradient>
          </Defs>
          <Rect width={48} height={48} rx={12} fill="url(#igGrad)" />
          <Rect
            x={13}
            y={13}
            width={22}
            height={22}
            rx={7}
            fill="none"
            stroke="#fff"
            strokeWidth={2.6}
          />
          <Circle
            cx={24}
            cy={24}
            r={5.5}
            fill="none"
            stroke="#fff"
            strokeWidth={2.6}
          />
          <Circle cx={31.5} cy={16.5} r={1.7} fill="#fff" />
        </>
      )}

      {app === 'youtube' && (
        <>
          <Rect width={48} height={48} rx={12} fill="#fff" />
          <Rect x={8} y={14} width={32} height={20} rx={6} fill="#FF0000" />
          <Path d="M21 20v8l7-4z" fill="#fff" />
        </>
      )}

      {app === 'snapchat' && (
        <>
          <Rect width={48} height={48} rx={12} fill="#FFFC00" />
          <Path
            d="M24 11c-4 0-6.5 3-6.5 6.7 0 1.5.1 2.6-.4 3.3-.6.8-2.1.6-2.6 1.4-.4.8.8 1.4 1.9 1.9-.3 1.6-2.4 2-2.3 2.9.1.9 2.3.7 3.9 1.3 1 .4 1.6 2 3.9 2s2.9-1.6 3.9-2c1.6-.6 3.8-.4 3.9-1.3.1-.9-2-1.3-2.3-2.9 1.1-.5 2.3-1.1 1.9-1.9-.5-.8-2-.6-2.6-1.4-.5-.7-.4-1.8-.4-3.3C30.5 14 28 11 24 11z"
            fill="#fff"
          />
        </>
      )}

      {app === 'reddit' && (
        <>
          <Rect width={48} height={48} rx={12} fill="#FF4500" />
          <Circle cx={24} cy={27} r={8.5} fill="#fff" />
          <Circle cx={20.5} cy={26.5} r={1.7} fill="#FF4500" />
          <Circle cx={27.5} cy={26.5} r={1.7} fill="#FF4500" />
          <Path
            d="M20 31c2.4 1.5 5.6 1.5 8 0"
            stroke="#FF4500"
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={24} cy={14.5} r={1.9} fill="#fff" />
          <Path d="M24 16.4v4" stroke="#fff" strokeWidth={1.6} />
        </>
      )}

      {app === 'x' && (
        <>
          <Rect width={48} height={48} rx={12} fill="#000" />
          <Path
            d="M15 14.5l7.3 9.1L15 33.5h2.3l6-6.9 5.5 6.9H34l-7.7-9.6L33.2 14.5h-2.3l-5.5 6.3-5-6.3z"
            fill="#fff"
          />
        </>
      )}
    </Svg>
  )
}

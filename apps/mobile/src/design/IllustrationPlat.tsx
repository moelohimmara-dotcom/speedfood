import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { couleurs as c } from './tokens';
export function IllustrationPlat({ type = 'bol', taille = 170 }: { type?: 'bol' | 'grillade' | 'jus' | 'poisson' | 'salade' | 'dessert' | 'cafe'; taille?: number }) {
  return <Svg width={taille} height={taille * .8} viewBox="0 0 200 160" accessibilityLabel="Illustration de démonstration" role="img">
    <Ellipse cx="100" cy="139" rx="68" ry="8" fill={c.encre} opacity={.09} />
    {type === 'jus' ? <>
      <Path d="M69 38h64l-8 91c-10 13-38 13-48 0z" fill={c.surface} stroke={c.encre} strokeWidth="3" />
      <Path d="m74 66 54-1-6 62c-10 9-30 9-41 0z" fill={c.action} />
      <Path d="m104 80 15-64 24-9" fill="none" stroke={c.encre} strokeWidth="5" strokeLinecap="round" />
      <Circle cx="64" cy="51" r="22" fill={c.orange} stroke={c.encre} strokeWidth="2" />
      <Circle cx="64" cy="51" r="14" fill={c.mangue} />
      <Path d="M139 76q32-17 24-34-24-2-24 34" fill={c.succes} />
    </> : <>
      <Path d="M30 82q6 57 70 57t70-57" fill={c.surface} stroke={c.encre} strokeWidth="3" />
      <Ellipse cx="100" cy="81" rx="70" ry="32" fill={c.fond} stroke={c.encre} strokeWidth="3" />
      <Ellipse cx="99" cy="78" rx="59" ry="24" fill={type === 'bol' ? c.orange : c.mangue} />
      {type === 'poisson' ? <>
        <Path d="M48 78q26-20 54-6 14 7 26-6-2 12 2 20-14-11-26-4-28 12-52-3z" fill={c.surface} stroke={c.encre} strokeWidth="3" strokeLinejoin="round" />
        <Circle cx="66" cy="74" r="4" fill={c.encre} />
        <Path d="M84 66q10 8 0 16M98 64q10 10 0 20" stroke={c.bordure} strokeWidth="3" fill="none" strokeLinecap="round" />
      </> : type === 'salade' ? <>
        <Path d="M56 80q-8-24 14-30 4 16-14 30M84 76q-2-28 20-32 2 18-20 32M110 78q4-24 24-24-2 18-24 24" fill={c.succes} />
        <Circle cx="70" cy="86" r="7" fill={c.rouge} /><Circle cx="126" cy="84" r="7" fill={c.rouge} /><Circle cx="100" cy="66" r="6" fill={c.mangue} />
      </> : type === 'dessert' ? <>
        <Path d="M58 96l16-34 44 22-8 16z" fill={c.surface} stroke={c.encre} strokeWidth="3" strokeLinejoin="round" />
        <Path d="M74 62l6 14 38 8" fill={c.mangue} />
        <Circle cx="72" cy="56" r="8" fill={c.action} />
        <Path d="M72 48q2-8 10-10" stroke={c.succes} strokeWidth="3" fill="none" strokeLinecap="round" />
      </> : type === 'cafe' ? <>
        <Path d="M58 58h62l-6 40a10 10 0 0 1-10 8H74a10 10 0 0 1-10-8z" fill={c.surface} stroke={c.encre} strokeWidth="3" />
        <Path d="M120 66q18 2 14 16-3 12-20 10" fill="none" stroke={c.encre} strokeWidth="3" />
        <Path d="M62 58h54" stroke={c.action} strokeWidth="5" strokeLinecap="round" />
      </> : type === 'bol' ? <>
        <Path d="M52 76q22-32 51-13l-1 29q-28 14-50-3" fill={c.surface} />
        <Path d="m61 72 8 2m7-6 7 3m-24 9 9 3m12-7 9 2m-16 8 8 3" stroke={c.bordure} strokeWidth="3" strokeLinecap="round" />
        <Circle cx="127" cy="72" r="13" fill={c.action} /><Circle cx="132" cy="91" r="10" fill={c.rouge} />
      </> : <>
        <Rect x="60" y="62" width="73" height="34" rx="15" fill={c.action} transform="rotate(-12 100 80)" />
        <Path d="m74 66 7 23m10-27 7 24m10-28 7 23" stroke={c.encre} strokeWidth="3" strokeLinecap="round" />
      </>}
      <Path d="M111 54q-1-25 19-29 11 19-19 29 M118 56q19-21 35-8-8 19-35 8" fill={c.succes} />
      <Path d="M45 35q-8-9 0-18M65 30q-8-9 0-18" stroke={c.secondaire} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>}
  </Svg>;
}

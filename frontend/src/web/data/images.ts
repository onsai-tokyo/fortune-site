// iOS版 Assets.xcassets から変換した自然の写真（public/images）
const base = `${import.meta.env.BASE_URL}images`
export const images = {
  mountains: `${base}/QuietMountains.webp`,
  welcomeSky: `${base}/WelcomeSky.webp`,
  moonClouds: `${base}/BookMoonClouds.webp`,
  starMountains: `${base}/BookStarMountains.webp`,
  dunes: `${base}/QuietDunes.webp`,
  flower: `${base}/QuietFlower.webp`,
  leaves: `${base}/QuietLeaves.webp`,
  // ReadingNature を12枚に切り分けたもの
  nature: {
    moonHaze: `${base}/nature_00.webp`,
    cosmos: `${base}/nature_01.webp`,
    dunes: `${base}/nature_02.webp`,
    leaf: `${base}/nature_03.webp`,
    mistyMountains: `${base}/nature_04.webp`,
    seaLight: `${base}/nature_05.webp`,
    tree: `${base}/nature_06.webp`,
    shell: `${base}/nature_07.webp`,
    clouds: `${base}/nature_08.webp`,
    pampas: `${base}/nature_09.webp`,
    ripple: `${base}/nature_10.webp`,
    stones: `${base}/nature_11.webp`,
  },
} as const

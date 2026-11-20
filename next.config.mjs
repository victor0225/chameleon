/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 새 흐름(작업 K~L)에서 없앤 화면의 옛 주소. 진단 설문·프롬프트 쓰기는 첫 화면 입력 칸으로, 랭킹은 시험으로 옮겼다.
  async redirects() {
    return [
      { source: "/diagnosis", destination: "/", permanent: false },
      { source: "/diagnosis/prompt", destination: "/", permanent: false },
      { source: "/prompt", destination: "/", permanent: false },
      { source: "/ranking", destination: "/exam", permanent: false },
    ];
  },
};

export default nextConfig;

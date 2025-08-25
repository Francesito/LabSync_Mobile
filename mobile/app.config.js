import 'dotenv/config';

export default {
  expo: {
    name: "labsync-mobile",
    slug: "labsync-mobile",
    scheme: "mobile",
    extra: { API_URL: process.env.EXPO_PUBLIC_API_URL }
  }
};

import 'dotenv/config';

export default {
  expo: {
    name: "labsync-mobile",
    slug: "labsync-mobile",
    extra: { API_URL: process.env.API_URL }
  }
};

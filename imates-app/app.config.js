const BUILD_VARIANTS = {
  RELEASE: {
    name: '手机学伴',
    package: 'com.cosinetech.imates.edu',
  },
  INTERNAL: {
    name: '手机学伴内测版',
    package: 'com.cosinetech.imates.edu.internal',
  },
  DEVELOPMENT: {
    name: '手机学伴开发版',
    package: 'com.cosinetech.imates.edu.development',
  },
};

module.exports = ({ config }) => {
  const channel = process.env.EXPO_PUBLIC_BUILD_CHANNEL || 'RELEASE';
  const variant = BUILD_VARIANTS[channel] || BUILD_VARIANTS.RELEASE;

  return {
    ...config,
    name: variant.name,
    android: {
      ...config.android,
      package: variant.package,
    },
  };
};

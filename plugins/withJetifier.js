const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withJetifier(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;

    const setProperty = (key, value) => {
      const index = properties.findIndex((p) => p.key === key);
      if (index > -1) {
        properties[index].value = value;
      } else {
        properties.push({ type: 'property', key, value });
      }
    };

    setProperty('android.enableJetifier', 'true');

    return config;
  });
};

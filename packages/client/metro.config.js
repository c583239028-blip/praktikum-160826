const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.transformer.babelTransformerPath =
  require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

config.watchFolders = [
  path.resolve(projectRoot, 'src'),
  path.resolve(workspaceRoot, 'packages', 'shared'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-webrtc') {
    if (platform === 'android' || platform === 'ios') {
      return context.resolveRequest(
        context,
        '@livekit/react-native-webrtc',
        platform
      );
    }
    // web: use mock (no native WebRTC)
    return {
      filePath: path.resolve(projectRoot, 'src/mocks/webrtc.mock.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

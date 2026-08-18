// __mocks__/svgMock.js
// Stub for .svg imports so jest doesn't try to parse SVG files as JS.
const React = require('react');
const SvgMock = (props) => React.createElement('svg', props);
SvgMock.ReactComponent = SvgMock;
module.exports = SvgMock;
module.exports.default = SvgMock;

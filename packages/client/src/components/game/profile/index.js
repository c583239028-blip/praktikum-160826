import React from 'react';
import PropTypes from 'prop-types';
import Svg, { Path, Circle, Line } from 'react-native-svg';

// ─────────────────────────────────────────────
// Small, dependency-light icon set (react-native-svg)
// All icons accept `size` and `color` so callers can
// theme them using Colors.* from constants/design.js
// ─────────────────────────────────────────────

const iconPropTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
};

const iconDefaultProps = {
  size: 24,
  color: '#1F293B',
};

export function BackIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
BackIcon.propTypes = iconPropTypes;
BackIcon.defaultProps = iconDefaultProps;

export function UserGroupAddIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Line x1={19} y1={8} x2={19} y2={14} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={16} y1={11} x2={22} y2={11} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
UserGroupAddIcon.propTypes = iconPropTypes;
UserGroupAddIcon.defaultProps = iconDefaultProps;

export function ShareIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={2.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={6} cy={12} r={2.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={18} cy={19} r={2.5} stroke={color} strokeWidth={1.8} />
      <Line x1={8.2} y1={10.7} x2={15.8} y2={6.3} stroke={color} strokeWidth={1.8} />
      <Line x1={8.2} y1={13.3} x2={15.8} y2={17.7} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
ShareIcon.propTypes = iconPropTypes;
ShareIcon.defaultProps = iconDefaultProps;

export function FlagIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 21V4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M5 4h11.5c1.2 0 1.8 1.4.9 2.2L14 9l3.4 2.8c.9.8.3 2.2-.9 2.2H5V4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
FlagIcon.propTypes = iconPropTypes;
FlagIcon.defaultProps = iconDefaultProps;

export function CloseIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={5} x2={19} y2={19} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={19} y1={5} x2={5} y2={19} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
CloseIcon.propTypes = iconPropTypes;
CloseIcon.defaultProps = iconDefaultProps;

export function ChevronRightIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
ChevronRightIcon.propTypes = iconPropTypes;
ChevronRightIcon.defaultProps = iconDefaultProps;

export function UserRemoveIcon({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Line x1={16} y1={11} x2={22} y2={11} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
UserRemoveIcon.propTypes = iconPropTypes;
UserRemoveIcon.defaultProps = iconDefaultProps;

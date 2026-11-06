const React = require("react");

const MapView = React.forwardRef((props, ref) =>
  React.createElement("View", { ...props, ref }),
);
MapView.Marker = (props) => React.createElement("View", props);

module.exports = {
  __esModule: true,
  default: MapView,
  Marker: MapView.Marker,
};

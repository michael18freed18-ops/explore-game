import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DrK7r9xM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!ref.current) return;
		let stop = () => {};
		let cancelled = false;
		import("./engine-tfORBya0.mjs").then((mod) => {
			if (cancelled || !ref.current) return;
			stop = mod.startGame(ref.current);
		});
		return () => {
			cancelled = true;
			stop();
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref,
		className: "game-root sm-root",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", { className: "sm-canvas" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sm-hud",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm-status",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "sm-found",
								children: "Found 0/150"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "sm-place",
								children: "Meadow"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "sm-stam",
								"aria-hidden": "true",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sm-quality",
								children: "Auto · medium"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "sm-map",
						"aria-label": "Enlarge the map"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm-stick",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sm-knob" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm-actions",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								children: "Jump"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								children: "Climb"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								children: "Sense"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "sm-keys",
						children: "WASD move · drag to look · Q and E turn · Space jump · Shift climb · F sense"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sm-start",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "sm-eyebrow",
						children: "No enemies. Just weather."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Stillmere" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "sm-lead",
						children: "A fixed 8 km of meadow, wood, desert, snow, marsh and shore. One hundred and fifty things are still out there."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							window.__stillmereArm = true;
						},
						children: "Begin"
					})
				]
			})
		]
	});
}
//#endregion
export { Home as component };

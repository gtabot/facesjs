import { Face } from "./generate";
import override, { Overrides } from "./override";
import svgs from "./svgs";

const addWrapper = (svgString: string) => `<g>${svgString}</g>`;

const addTransform = (element: SVGGraphicsElement, newTransform: string) => {
  const oldTransform = element.getAttribute("transform");
  element.setAttribute(
    "transform",
    `${oldTransform ? `${oldTransform} ` : ""}${newTransform}`
  );
};

const rotateCentered = (element: SVGGraphicsElement, angle: number) => {
  const bbox = element.getBBox();
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  addTransform(element, `rotate(${angle} ${cx} ${cy})`);
};

const scaleStrokeWidthAndChildren = (
  element: SVGGraphicsElement,
  factor: number
) => {
  const strokeWidth = element.getAttribute("stroke-width");
  if (strokeWidth) {
    element.setAttribute(
      "stroke-width",
      String(parseFloat(strokeWidth) / factor)
    );
  }
  const children = (element.childNodes as unknown) as SVGGraphicsElement[];
  for (let i = 0; i < children.length; i++) {
    scaleStrokeWidthAndChildren(children[i], factor);
  }
};

// Scale relative to the center of bounding box of element e, like in Raphael.
// Set x and y to 1 and this does nothing. Higher = bigger, lower = smaller.
const scaleCentered = (element: SVGGraphicsElement, x: number, y: number) => {
  const bbox = element.getBBox();
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const tx = (cx * (1 - x)) / x;
  const ty = (cy * (1 - y)) / y;

  addTransform(element, `scale(${x} ${y}) translate(${tx} ${ty})`);

  // Keep apparent stroke width constant, similar to how Raphael does it (I think)
  if (
    Math.abs(x) !== 1 ||
    Math.abs(y) !== 1 ||
    Math.abs(x) + Math.abs(y) !== 2
  ) {
    const factor = (Math.abs(x) + Math.abs(y)) / 2;
    scaleStrokeWidthAndChildren(element, factor);
  }
};

// Translate element such that its center is at (x, y). Specifying xAlign and yAlign can instead make (x, y) the left/right and top/bottom.
const translate = (
  element: SVGGraphicsElement,
  x: number,
  y: number,
  xAlign = "center",
  yAlign = "center"
) => {
  const bbox = element.getBBox();
  let cx;
  let cy;
  if (xAlign === "left") {
    cx = bbox.x;
  } else if (xAlign === "right") {
    cx = bbox.x + bbox.width;
  } else {
    cx = bbox.x + bbox.width / 2;
  }
  if (yAlign === "top") {
    cy = bbox.y;
  } else if (yAlign === "bottom") {
    cy = bbox.y + bbox.height;
  } else {
    cy = bbox.y + bbox.height / 2;
  }

  addTransform(element, `translate(${x - cx} ${y - cy})`);
};

// Defines the range of fat/skinny, relative to the original width of the default head.
const fatScale = (fatness: number) => 0.8 + 0.2 * fatness;

type FeatureInfo = {
  name: Exclude<keyof Face, "fatness" | "teamColors">;
  positions: [null] | [number, number][];
  scaleFatness?: true;
};

const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const character = str.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const deterministicRandom = (face: Face) => {
  const hash =
    hashCode(face.body.id) +
    hashCode(face.body.color) +
    hashCode(face.head.id) +
    hashCode("" + face.fatness) +
    hashCode(face.hair.id) +
    hashCode(face.hair.color);
  return (hash % 1000) / 1000;
};

const ageHair = (hairId: String) => {
  switch (hairId) {
    case "afro":
      return "short";
    case "afro2":
      return "short";
    case "blowoutFade":
      return "cropFade2";
    case "cornrows":
      return "short-fade";
    case "curly3":
      return "short3";
    case "dreads":
      return "short-fade";
    case "emo":
      return "short2";
    case "faux-hawk":
      return "short3";
    case "fauxhawk-fade":
      return "short-fade";
    case "high":
      return "short";
    case "juice":
      return "short2";
    case "longHair":
      return "short-fade";
    case "shaggy2":
      return "shaggy1";
    case "short-bald":
      return "short-bald";
    case "shortBangs":
      return "short-bald";
    case "spike2":
      return "short2";
    case "spike3":
      return "short2";
    case "spike4":
      return "short2";
    case "tall-fade":
      return "crop-fade";
    default:
      return "short-fade";
  }
};

const drawFeature = (svg: SVGSVGElement, face: Face, info: FeatureInfo) => {
  const feature = Object.assign({}, face[info.name]);
  if (!feature || !svgs[info.name]) {
    return;
  }
  if (face.aging && face.aging.enabled) {
    if (
      info.name === "hair" &&
      face.aging.age + face.aging.maturity / 2 >= 30 &&
      deterministicRandom(face) < 0.5
    )
      feature.id = ageHair(feature.id);
    else if (
      info.name === "hairBg" &&
      face.aging.age + face.aging.maturity / 2 >= 27 &&
      deterministicRandom(face) < 0.75
    )
      feature.id = "none";
  }

  // @ts-ignore
  let featureSVGString = svgs[info.name][feature.id];
  if (!featureSVGString) {
    return;
  }

  // @ts-ignore
  if (feature.shave) {
    let shave;
    if (face.aging && face.aging.enabled)
      if (face.aging.age + face.aging.maturity > 23) shave = feature.shave;
      else shave = "rgba(0,0,0,0)";
    else shave = feature.shave;
    // @ts-ignore
    featureSVGString = featureSVGString.replace("$[faceShave]", shave);
    // @ts-ignore
    featureSVGString = featureSVGString.replace("$[headShave]", shave);
  }

  featureSVGString = featureSVGString.replace("$[skinColor]", face.body.color);
  featureSVGString = featureSVGString.replace(
    /\$\[hairColor\]/g,
    face.hair.color
  );
  featureSVGString = featureSVGString.replace(
    /\$\[primary\]/g,
    face.teamColors[0]
  );
  featureSVGString = featureSVGString.replace(
    /\$\[secondary\]/g,
    face.teamColors[1]
  );
  featureSVGString = featureSVGString.replace(
    /\$\[accent\]/g,
    face.teamColors[2]
  );

  for (let i = 0; i < info.positions.length; i++) {
    svg.insertAdjacentHTML("beforeend", addWrapper(featureSVGString));

    const position = info.positions[i];

    if (position !== null) {
      // Special case, for the pinocchio nose it should not be centered but should stick out to the left or right
      let xAlign;
      if (feature.id === "nose4" || feature.id === "pinocchio") {
        // @ts-ignore
        xAlign = feature.flip ? "right" : "left";
      } else {
        xAlign = "center";
      }

      translate(
        svg.lastChild as SVGGraphicsElement,
        position[0],
        position[1],
        xAlign
      );
    }

    if (feature.hasOwnProperty("angle")) {
      // @ts-ignore
      rotateCentered(svg.lastChild, (i === 0 ? 1 : -1) * feature.angle);
    }

    // Flip if feature.flip is specified or if this is the second position (for eyes and eyebrows). Scale if feature.size is specified.
    // @ts-ignore
    const scale = feature.hasOwnProperty("size") ? feature.size : 1;
    // @ts-ignore
    if (feature.flip || i === 1) {
      // @ts-ignore
      scaleCentered(svg.lastChild, -scale, scale);
    } else if (scale !== 1) {
      // @ts-ignore
      scaleCentered(svg.lastChild, scale, scale);
    }

    if (info.scaleFatness && info.positions[0] !== null) {
      // Scale individual feature relative to the edge of the head. If fatness is 1, then there are 47 pixels on each side. If fatness is 0, then there are 78 pixels on each side.
      const distance = (78 - 47) * (1 - face.fatness);
      // @ts-ignore
      translate(svg.lastChild, distance, 0, "left", "top");
    }
  }

  if (
    info.scaleFatness &&
    info.positions.length === 1 &&
    info.positions[0] === null
  ) {
    // @ts-ignore
    scaleCentered(svg.lastChild, fatScale(face.fatness), 1);
  }
};

const display = (
  container: HTMLElement | string | null,
  face: Face,
  overrides: Overrides
) => {
  override(face, overrides);

  const containerElement =
    typeof container === "string"
      ? document.getElementById(container)
      : container;
  if (!containerElement) {
    throw new Error("container not found");
  }
  containerElement.innerHTML = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("version", "1.2");
  svg.setAttribute("baseProfile", "tiny");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 400 600");
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

  // Needs to be in the DOM here so getBBox will work
  containerElement.appendChild(svg);

  const featureInfos: FeatureInfo[] = [
    {
      name: "hairBg",
      positions: [null],
      scaleFatness: true,
    },
    {
      name: "body",
      positions: [null],
    },
    {
      name: "jersey",
      positions: [null],
    },
    {
      name: "ear",
      positions: [
        [55, 325] as [number, number],
        [345, 325] as [number, number],
      ],
      scaleFatness: true,
    },
    {
      name: "head",
      positions: [null], // Meaning it just gets placed into the SVG with no translation
      scaleFatness: true,
    },
    {
      name: "eyeLine",
      positions: [null],
    },
    {
      name: "smileLine",
      positions: [
        [150, 435],
        [250, 435],
      ],
    },
    {
      name: "miscLine",
      positions: [null],
    },
    {
      name: "facialHair",
      positions: [null],
      scaleFatness: true,
    },
    {
      name: "eye",
      positions: [
        [140, 310],
        [260, 310],
      ],
    },
    {
      name: "eyebrow",
      positions: [
        [140, 270],
        [260, 270],
      ],
    },
    {
      name: "mouth",
      positions: [[200, 440]],
    },
    {
      name: "nose",
      positions: [[200, 370]],
    },
    {
      name: "hair",
      positions: [null],
      scaleFatness: true,
    },
    {
      name: "glasses",
      positions: [null],
      scaleFatness: true,
    },
    {
      name: "accessories",
      positions: [null],
      scaleFatness: true,
    },
  ];

  for (const info of featureInfos) {
    if (face.aging && face.aging.enabled) {
      if (
        info.name === "miscLine" &&
        face.aging.age + face.aging.maturity >= 22 &&
        face.miscLine.id.startsWith("freckles")
      )
        continue;
      if (
        info.name === "miscLine" &&
        face.aging.age + face.aging.maturity < 25 &&
        face.miscLine.id.startsWith("chin")
      )
        continue;
      if (
        info.name === "smileLine" &&
        face.aging.age + face.aging.maturity < 27
      )
        continue;
      if (info.name === "eyeLine" && face.aging.age + face.aging.maturity < 30)
        continue;
      if (
        info.name === "miscLine" &&
        face.aging.age + face.aging.maturity < 34 &&
        face.miscLine.id.startsWith("forehead")
      )
        continue;
    }
    drawFeature(svg, face, info);
  }
};

export default display;

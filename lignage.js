function Lignage(svg, nodes, options = {}) {
  class BaseNode {
    constructor() {
      this.parents = [];
      this.spouses = [];
      this.children = [];
      this.x = 0;
      this.y = 0;
      this.skips = 0;
      this.isRoot = false;
    }

    getChildren() {
      /* Get all the node's children, whereas the children attribute
       * for a kin node only represents out-of-marriage children */
      if (!this.isKin() || !this.isMarried()) {
        return this.children;
      }

      let children = [];
      if (!this.spouses[0].before) {
        children = children.concat(this.children);
      }
      for (let spouse of this.spouses) {
        children = children.concat(spouse.children);
      }
      if (this.spouses[0].before) {
        children = children.concat(this.children);
      }
      return children;
    }

    hasParents() {
      return this.parents.length > 0;
    }

    hasChildren() {
      return this.getChildren().length > 0;
    }

    isMarried() {
      return this.spouses.length > 0;
    }

    isRemarried() {
      return this.spouses.length > 1;
    }

    isKin() {
      return this.isRoot || this.hasParents();
    }

    getDepth() {
      let depth = 0;
      for (let child of this.getChildren()) {
        let d = child.getDepth() + child.skips + 1;
        if (d > depth) depth = d;
      }
      return depth;
    }

    getX() {
      return !rotated() ? this.x : this.y;
    }

    getCoord() {
      const {x, y} = this.getPosition();
      return !rotated() ? [x, y] : [y, x];
    }

    getPosition() {
      /* Compute the position of the node itself, whereas the x and y attributes
       * describe the position of the group (with spouses) to which the node belongs
       * and may not be defined for non-kin nodes */
      if (!this.isMarried()) {
        return {x: this.x, y: this.y};
      }
      else if (this.isKin()) {
        let index = 0;
        if (this.isRemarried() || this.spouses[0].before) {
          index = 1;
        }
        if (!rotated()) {
          return {x: this.x + (options.width + options.spouseMargin) * index, y: this.y};
        }
        else {
          return {x: this.x, y: this.y + (options.height + options.spouseMargin) * index};
        }
      }
      else {
        let index = 1;
        if (this.spouses[0].isRemarried()) {
          if (this.spouses[0].spouses[0] == this) index = 0;
          else index = 2;
        }
        else if (this.before) {
          index = 0;
        }
        if (!rotated()) {
          return {x: this.spouses[0].x + (options.width + options.spouseMargin) * index, y: this.spouses[0].y};
        }
        else {
          return {x: this.spouses[0].x, y: this.spouses[0].y + (options.height + options.spouseMargin) * index};
        }
      }
    }

    getSize() {
      /* Compute the main dimension of the node group (only for kin nodes) */
      if (!rotated()) {
        return options.width + (options.width + options.spouseMargin) * this.spouses.length;
      }
      else {
        return options.height + (options.height + options.spouseMargin) * this.spouses.length;
      }
    }

    setCoord(x, y) {
      if (!rotated()) {
        this.x = x;
        if (y !== null) this.y = y;
      }
      else {
        this.y = x;
        if (y !== null) this.x = y;
      }
    }

    translate(dx) {
      if (!rotated()) {
        this.x += dx;
      }
      else {
        this.y += dx;
      }
      for (let child of this.getChildren()) {
        child.translate(dx);
      }
    }
  }

  class Node extends BaseNode {
    static TREE = {};

    static get(id) {
      const ret = Node.TREE[id];
      if (!ret) {
        throw Error(`Unknown id '${id}'`);
      }
      return ret;
    }

    constructor(obj) {
      if (obj.id === undefined) {
        throw Error("Node without an id");
      }
      if (Node.TREE[obj.id]) {
        throw Error(`Node '${obj.id}' already exists`);
      }
      if (Object.entries(Node.TREE).length > 0 && !obj.spouse && !obj.parent) {
        throw Error(`Non-root node '${obj.id}' without spouse nor parent`);
      }
      if (obj.spouse && !Node.get(obj.spouse).isKin()) {
        throw Error(`Cannot add spouse to non-kin node '${obj.spouse}'`);
      }
      if (obj.spouse && Node.get(obj.spouse).isRemarried()) {
        throw Error(`Node '${obj.spouse}' cannot have more than two spouses`);
      }
      if (obj.spouse && Node.get(obj.spouse).isMarried() && Node.get(obj.spouse).children.length > 0) {
        throw Error(`Node '${obj.spouse}' cannot have two spouses and out-of-marriage children`);
      }
      if (obj.parent && Node.get(obj.parent).isRemarried()) {
        throw Error(`Node '${obj.parent}' cannot have two spouses and out-of-marriage children`);
      }
      if (obj.spouse && obj.parent) {
        throw Error(`Cannot handle consanguine union between '${obj.id}' and '${obj.spouse}', use the 'links' option instead`);
      }
      super();
      this.id = obj.id;
      this.name = obj.name;
      if (obj.text) this.text = obj.text;
      if (obj.class) this.class = obj.class;
      if (obj.url) this.url = obj.url;
      if (obj.image) this.image = obj.image;
      if (obj.parent) {
        const parent = Node.get(obj.parent);
        if (parent.isKin()) {
          this.parents = [parent];
          if (parent.children.length == 0 && parent.hasChildren()) {
            parent.spouses[0].before = true;
          }
        }
        else {
          this.parents = [parent, parent.spouses[0]];
        }
        parent.children.push(this);
      }
      if (obj.spouse) {
        this.spouses = [Node.get(obj.spouse)];
        Node.get(obj.spouse).spouses.push(this);
      }
      if (obj.align) this.align = obj.align;
      this.skips = obj.skips || 0;
      this.before = obj.before || false;
      this.virtual = obj.virtual || false;
      this.isRoot = (Object.entries(Node.TREE).length == 0);
      Node.TREE[this.id] = this;
    }

    remove(force = false) {
      if (this.isRoot && !force) {
        throw Error(`Cannot remove root node '${this.id}'`);
      }
      for (let parent of this.parents) {
        parent.children = parent.children.filter(x => x != this);
      }
      for (let spouse of this.spouses) {
        if (!this.isKin()) {
          spouse.spouses = spouse.spouses.filter(x => x != this);
        }
        else {
          spouse.remove();
        }
      }
      for (let child of this.children) {
        child.remove();
      }
      options.links = options.links.filter(x => x.start != this.id && x.end != this.id);
      delete Node.TREE[this.id];
    }
  }

  class PseudoNode extends BaseNode {
    constructor(node, level) {
      super();
      if (level <= 0) {
        throw Error("Should not happen");
      }
      else if (level == 1) {
        this.children = [node];
        this.x = node.x;
        this.y = node.y;
      }
      else {
        const child = new PseudoNode(node, level - 1);
        this.children = [child];
        this.x = child.x;
        this.y = child.y;
      }
    }
  }

  function makeElement(name, attr = {}, ...children) {
    const ns = "http://www.w3.org/2000/svg";
    const elem = document.createElementNS(ns, name);
    Object.entries(attr).forEach(function([k, v]) {
      if (v !== undefined) elem.setAttribute(k, v);
    });
    elem.append(...children);
    return elem;
  }

  function round(x, precision = 0) {
    return Math.round(x * 10 ** precision) / 10 ** precision;
  }

  function reversed() {
    return options.orient == "bottom" || options.orient == "right";
  }

  function rotated() {
    return options.orient == "left" || options.orient == "right";
  }

  function getWidth() {
    return !rotated() ? options.width : options.height;
  }

  function getHeight() {
    return !rotated() ? options.height : options.width;
  }

  function initializeOptions() {
    if (options.root === undefined) options.root = nodes[0].id;
    if (options.height === undefined) options.height = options.images? 160 : 50;
    if (options.width === undefined) options.width = 120;
    if (options.parentMargin === undefined) options.parentMargin = 80;
    if (options.spouseMargin === undefined) options.spouseMargin = 30;
    if (options.siblingMargin === undefined) options.siblingMargin = 30;
    if (options.cousinMargin === undefined) options.cousinMargin = 100;
    if (options.fontSize === undefined) options.fontSize = 16;
    if (options.fontWeight === undefined) options.fontWeight = "bold";
    if (options.exclude === undefined) options.exclude = [];
    if (options.links === undefined) options.links = [];
    if (options.fonts === undefined) options.fonts = [];
    if (options.align === undefined) options.align = "center";
    if (options.orient === undefined) options.orient = "top";

    const textRect = makeElement("rect", {x: 0, y: 0, width: options.width, height: options.height, rx: 10, ry: 10});
    defs.replaceChildren(makeElement("clipPath", {id: "clipText"}, textRect));

    if (options.images) {
      const imageRect = makeElement("rect", {x: (options.width - 100) / 2, y: (options.height - 100) / 2, width: 100, height: 100, rx: 10, ry: 10});
      defs.append(makeElement("clipPath", {id: "clipImage"}, imageRect));
    }
    if (options.editable) {
      const icons = {
        iconAdd: ["limegreen", "M4 0 h2 v4 h4 v2 h-4 v4 h-2 v-4 h-4 v-2 h4z"],
        iconEdit: ["royalblue", "M0 0 h10 v2 h-10z M0 4 h10 v2 h-10z M0 8 h10 v2 h-10z"],
        iconJoin: ["purple", "M5 2 a4 4 0 0 0 0 8 4 4 0 0 0 0 -8 m0 1.5 a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0 -5 M3 0 h4 v2 h-4z"],
        iconLeft: ["darkgray", "M6.75 0 L1.75 5 L6.75 10 L8.25 8.5 L4.75 5 L8.25 1.5z"],
        iconRight: ["darkgray", "M3.25 0 L8.25 5 L3.25 10 L1.75 8.5 L5.25 5 L1.75 1.5z"],
        iconTop: ["darkgray", "M0 6.75 L5 1.75 L10 6.75 L8.5 8.25 L5 4.75 L1.5 8.25z"],
        iconBottom: ["darkgray", "M0 3.25 L5 8.25 L10 3.25 L8.5 1.75 L5 5.25 L1.5 1.75z"],
        iconRemove: ["red", "M1.5 0 L5 3.5 L8.5 0 L10 1.5 L6.5 5 L10 8.5 L8.5 10 L5 6.5 L1.5 10 L0 8.5 L3.5 5 L0 1.5z"],
      };
      Object.entries(icons).forEach(function([id, [color, d]]) {
        const icon = makeElement("symbol", {id});
        icon.append(makeElement("rect", {x: 0, y: 0, width: 10, height: 10, rx: 1, ry: 1, fill: color}));
        icon.append(makeElement("path", {d, fill: "white", transform: "translate(2 2) scale(0.6)"}));
        defs.append(icon);
      });
    }
    const fonts = options.fonts;
    for (let family of [options.fontFamily, options.title?.fontFamily]) {
      const url = DEFAULT_FONTS[family];
      if (url) {
        fonts.push({family, url});
      }
    }
    return fonts;
  }

  function redefineRoot() {
    const node = Node.get(options.root);
    if (node != rootNode) {
      for (let parent of node.parents) {
        parent.children = parent.children.filter(x => x != node);
      }
      node.parents = [];
      node.isRoot = true;
      rootNode.remove(true);
    }
    rootNode = node;
  }

  const DEFAULT_FONTS = {
    Ballet: "https://fonts.gstatic.com/s/ballet/v27/QGYvz_MYZA-HM4NJtEtq.woff2",
    Cinzel: "https://fonts.gstatic.com/s/cinzel/v23/8vIJ7ww63mVu7gt79mT7.woff2",
  };

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const defs = makeElement("defs");
  svg.append(defs);

  let rootNode;
  const fonts = initializeOptions();
  initializeTree();
  loadFonts(fonts).then(drawTree);

  function initializeTree() {
    for (let node of nodes) {
      try {
        new Node(node);
      }
      catch(e) {
        console.warn(e.message);
      }
    }

    for (let exclude of options.exclude) {
      try {
        Node.get(exclude).remove();
      }
      catch(e) {
        console.warn(e.message);
      }
    }

    rootNode = Node.get(nodes[0].id);
    try {
      redefineRoot();
    }
    catch(e) {
      console.warn(e.message);
    }
  }

  function drawTree() {
    function drawCircle(container, x, y) {
      if (!rotated()) {
        container.append(makeElement("circle", {cx: round(x), cy: round(y), r: 5, fill: "black"}));
      }
      else {
        container.append(makeElement("circle", {cx: round(y), cy: round(x), r: 5, fill: "black"}));
      }
    }

    function drawLine(container, x1, y1, x2, y2, options = {}) {
      let line;
      if (!rotated()) {
        line = makeElement("line", {x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), stroke: "black"});
      }
      else {
        line = makeElement("line", {x1: round(y1), y1: round(x1), x2: round(y2), y2: round(x2), stroke: "black"});
      }
      if (options.class) {
        line.classList.add(options.class);
      }
      container.append(line);
    }

    function drawPath(container, x1, y1, x2, y2, dx, dy1, dy2, options = {}) {
      let path;
      if (!rotated()) {
        path = makeElement("path", {d: `M${round(x1)} ${round(y1)} v${round(dy1)} h${round(dx)} V${round(y2 + dy2)} H${round(x2)} V${round(y2)}`, stroke: "black", fill: "none"});
      }
      else {
        path = makeElement("path", {d: `M${round(y1)} ${round(x1)} h${round(dy1)} v${round(dx)} H${round(y2 + dy2)} V${round(x2)} H${round(y2)}`, stroke: "black", fill: "none"});
      }
      if (options.class) {
        path.classList.add(options.class);
      }
      container.append(path);
    }

    function drawNodes(node, container) {
      const {x, y} = node.getPosition();

      const elem = makeElement("g", {id: node.id, class: "node", transform: `translate(${round(x)} ${round(y)})`});
      if (node.class) elem.classList.add(node.class);
      if (!node.virtual) container.append(elem);

      elem.append(makeElement("rect", {
        x: 0,
        y: 0,
        rx: 7,
        ry: 7,
        height: options.height,
        width: options.width,
        fill: "white",
        stroke: "black"
      }));

      const text = makeElement("text", {
        class: "name",
        x: options.width / 2,
        y: 15,
        fill: "black",
        "clip-path": "url(#clipText)",
        "dominant-baseline": "central",
        "font-family": options.fontFamily,
        "font-size": options.fontSize,
        "font-variant": options.fontVariant,
        "font-weight": options.fontWeight,
        "text-anchor": "middle",
        cursor: node.url ? "pointer" : "default",
        style: "display: none"  // start hidden so that it does not affect viewbox calculation
      }, node.name || "");
      elem.append(node.url ? makeElement("a", {href: node.url, target: "_blank"}, text) : text);

      elem.append(makeElement("text", {
        class: "text",
        x: options.width / 2,
        y: options.height - 10,
        fill: "black",
        "clip-path": "url(#clipText)",
        "font-size": 14,
        "text-anchor": "middle",
        cursor: "default"
      }, node.text || ""));

      if (options.images && node.image) {
        elem.append(makeElement("image", {
          preserveAspectRatio: "xMidYMid slice",
          "clip-path": "url(#clipImage)",
          href: node.image,
          x: (options.width - 100) / 2,
          y: (options.height - 100) / 2,
          width: 100,
          height: 100
        }));
      }

      if (options.editable) {
        const buttons = makeElement("g", {class: "buttons", style: "display: none;"});
        const addButton = makeElement("use", {href: "#iconAdd", transform: `translate(${(options.width - (node.isKin() && !node.isRemarried() ? 0 : 22.5)) / 2} ${options.height - 25}) scale(2.25)`});
        const editButton = makeElement("use", {href: "#iconEdit", transform: `translate(2.5 2.5) scale(2.25)`});
        const joinButton = makeElement("use", {href: "#iconJoin", transform: `translate(${options.width / 2 - 22.5} ${options.height - 25}) scale(2.25)`});
        const leftButton = makeElement("use", {href: !rotated() ? "#iconLeft" : "#iconTop", transform: `translate(2.5 ${options.height - 25}) scale(2.25)`});
        const rightButton = makeElement("use", {href: !rotated() ? "#iconRight" : "#iconBottom", transform: `translate(${options.width - 25} ${options.height - 25}) scale(2.25)`});
        const removeButton = makeElement("use", {href: "#iconRemove", transform: `translate(${options.width - 25} 2.5) scale(2.25)`});
        buttons.append(addButton, editButton, joinButton, leftButton, rightButton, removeButton);
        elem.append(buttons);

        function prepareAdd() {
          function generateID(name) {
            // Try a camel-case version of the name provided
            let id = name.replaceAll(/ +(.)/g, (x,y) => y.toUpperCase());
            let index;
            if (id) {
              id = id[0].toLowerCase() + id.slice(1);
              if (!Node.TREE[id]) return id;
              index = 2;
            }
            else {
              id = "node";
              index = 0;
            }
            while (Node.TREE[`${id}${index}`]) {
              index++;
            }
            return `${id}${index}`;
          }
          const input = prompt("Name (Text)");
          if (input === null) return null;

          const match = input.match(/([^(]*)\((.*)\)/);
          if (match) {
            const id = generateID(match[1].trim());
            return {id, name: match[1].trim(), text: match[2].trim()};
          }
          else {
            const id = generateID(input.trim());
            return {id, name: input.trim()};
          }
        }
        addButton.addEventListener("click", function() {
          const obj = prepareAdd();
          if (obj !== null) {
            obj.parent = node.id;
            ret.add(obj);
          }
        });
        editButton.addEventListener("click", function() {
          const input = prompt("Name (Text)", (node.name || "") + (node.text ? ` (${node.text})` : ""));
          if (input !== null) {
            const match = input.match(/([^(]*)\((.*)\)/);
            if (match) {
              node.name = match[1].trim();
              node.text = match[2].trim();
            }
            else {
              node.name = input.trim();
              delete node.text;
            }
            redrawTree();
          }
        });
        joinButton.addEventListener("click", function() {
          const obj = prepareAdd();
          if (obj !== null) {
            obj.spouse = node.id;
            ret.add(obj);
          }
        });
        leftButton.addEventListener("click", function() {
          if (node.hasParents()) {
            const siblings = node.parents[0].children;
            const index = siblings.indexOf(node);
            if (index > 0) {
              siblings[index] = siblings[index - 1];
              siblings[index - 1] = node;
              redrawTree();
            }
          }
          else if (!node.isKin() && !node.before && !node.spouses[0].isRemarried()) {
            node.before = true;
            redrawTree();
          }
          else if (!node.isKin() && node.spouses[0].spouses[0] != node) {
            node.spouses[0].spouses.reverse();
            redrawTree();
          }
        });
        rightButton.addEventListener("click", function() {
          if (node.hasParents()) {
            const siblings = node.parents[0].children;
            const index = siblings.indexOf(node);
            if (index < siblings.length - 1) {
              siblings[index] = siblings[index + 1];
              siblings[index + 1] = node;
              redrawTree();
            }
          }
          else if (!node.isKin() && node.before && !node.spouses[0].isRemarried()) {
            node.before = false;
            redrawTree();
          }
          else if (!node.isKin() && node.spouses[0].isRemarried() && node.spouses[0].spouses[0] == node) {
            node.spouses[0].spouses.reverse();
            redrawTree();
          }
        });
        removeButton.addEventListener("click", function() {
          ret.remove(node.id);
        });
        elem.addEventListener("mouseover", function() {
          buttons.style.display = "block";
          addButton.style.display = (node.isRemarried() && node.children.length == 0) ? "none" : "block";
          joinButton.style.display = (node.isKin() && !node.isRemarried()) ? "block" : "none";
          leftButton.style.display = (node.hasParents() && node.parents[0].children.indexOf(node) > 0 ||
                                      !node.isKin() && !node.before && !node.spouses[0].isRemarried() ||
                                      !node.isKin() && node.spouses[0].spouses[0] != node) ? "block" : "none";
          rightButton.style.display = (node.hasParents() && node.parents[0].children.indexOf(node) < node.parents[0].children.length - 1 ||
                                       !node.isKin() && node.before && !node.spouses[0].isRemarried() ||
                                       !node.isKin() && node.spouses[0].isRemarried() && node.spouses[0].spouses[0] == node) ? "block" : "none";
        });
        elem.addEventListener("mouseout", function() {
          buttons.style.display = "none";
        });
      }

      if (node.isKin()) {
        for (let spouse of node.spouses) {
          drawNodes(spouse, container);
        }
        for (let child of node.getChildren()) {
          drawNodes(child, container);
        }
      }
    }

    function drawLinks(node, container) {
      function computeFraction(n) {
        // Return an appropriate fraction of the vertical spacing between parent and children nodes,
        // so that links won't collide in a situation where half-siblings are involved
        let child1, child2, isBefore, max1, min2;
        if (n.isRemarried() && n.spouses[0].hasChildren() && n.spouses[1].hasChildren()) {
          child1 = n.spouses[0].children.at(-1);
          child2 = n.spouses[1].children[0];
          isBefore = node == n.spouses[0];
          max1 = n.getX() + n.getSize() / 2;
          min2 = max1;
        }
        else if (n.isMarried() && n.spouses[0].hasChildren() && n.children.length > 0) {
          child1 = n.spouses[0].before ? n.spouses[0].children.at(-1) : n.children.at(-1);
          child2 = n.spouses[0].before ? n.children[0] : n.spouses[0].children[0];
          isBefore = node == n && !n.spouses[0].before || node != n && n.spouses[0].before;
          max1 = n.getX() + getWidth();
          min2 = max1 + options.spouseMargin;
        }
        else {
          return 1/2;
        }
        const x1 = child1.getCoord()[0] + getWidth() / 2;
        const x2 = child2.getCoord()[0] + getWidth() / 2;
        if (x1 <= max1 && x2 >= min2) {
          return 1/2;
        }
        if (x1 > max1) {
          return isBefore ? 2/3 : 1/3;
        }
        else {
          return isBefore ? 1/3 : 2/3;
        }
      }

      if (node.isKin()) {
        if (!node.virtual && node.children.length > 0) {
          // Draw links between a single parent and their children
          const fraction = computeFraction(node);
          let [x1, y1] = node.getCoord();
          x1 += getWidth() / 2;
          if (!reversed()) {
            y1 += getHeight();
          }
          let dy = options.parentMargin * fraction;
          if (reversed()) {
            dy = -dy;
          }
          const children = node.children.filter(x => !x.virtual && !linkReplace.includes(x.id));
          if (children.length > 0) {
            drawLine(container, x1, y1, x1, y1 + dy);
            drawLine(container, Math.min(x1, children[0].getCoord()[0] + getWidth() / 2), y1 + dy, Math.max(x1, children.at(-1).getCoord()[0] + getWidth() / 2), y1 + dy);
          }
          for (let child of children) {
            let [x2, y2] = child.getCoord();
            x2 += getWidth() / 2;
            if (reversed()) {
              y2 += getHeight();
            }
            drawLine(container, x2, y1 + dy, x2, y2);
          }
        }
        for (let spouse of node.spouses) {
          drawLinks(spouse, container);
        }
        for (let child of node.getChildren()) {
          drawLinks(child, container);
        }
        return;
      }

      if (node.virtual || linkReplace.includes(node.id)) return;

      // Draw a link between spouses
      const [x1, y1] = node.getCoord();
      const [x2, y2] = node.spouses[0].getCoord();
      const x = (x1 + x2 + getWidth()) / 2;
      const y = y1 + getHeight() / 2;
      if (!node.spouses[0].virtual) {
        drawCircle(container, x, y);
        drawLine(container, x - options.spouseMargin / 2, y, x + options.spouseMargin / 2, y);
      }

      // Draw links between parents and children
      const fraction = computeFraction(node.spouses[0]);
      let dy = getHeight() / 2 + options.parentMargin * fraction;
      if (reversed()) {
        dy = -dy;
      }
      const children = node.children.filter(x => !x.virtual && !linkReplace.includes(x.id));
      if (children.length > 0) {
        drawLine(container, x, y, x, y + dy);
        drawLine(container, Math.min(x, children[0].getCoord()[0] + getWidth() / 2), y + dy, Math.max(x, children.at(-1).getCoord()[0] + getWidth() / 2), y + dy);
      }
      for (let child of children) {
        let [x3, y3] = child.getCoord();
        if (reversed()) {
          y3 += getHeight();
        }
        drawLine(container, x3 + getWidth() / 2, y + dy, x3 + getWidth() / 2, y3);
      }
    }

    function drawExtraLinks(container) {
      const replacements = [];

      function getCoordinates(id, delta) {
        if (typeof id == "object") {
          const [x1, y1] = Node.get(id[0]).getCoord();
          const [x2, y2] = Node.get(id[1]).getCoord();
          if (!reversed()) {
            return [(x1 + x2) / 2, (y1 + y2 - getHeight()) / 2];
          }
          else {
            return [(x1 + x2) / 2, (y1 + y2 + getHeight()) / 2];
          }
        }
        else {
          const [x, y] = Node.get(id).getCoord();
          return [x + (delta || 0), y];
        }
      }

      /* Draw additional links that are not expressed by the tree structure */
      for (let link of options.links) {
        let x1, x2, y1, y2;
        try {
          [x1, y1] = getCoordinates(link.start, link.startDx);
          [x2, y2] = getCoordinates(link.end, link.endDx);
        }
        catch(e) {
          console.warn(e.message);
          continue;
        }
        if (link.replace) replacements.push(link.end);
        let dy = options.parentMargin * (link.y === undefined ? 0.5 : link.y);
        if (reversed()) {
          dy = -dy;
        }
        if (link.type == "union" || link.type === undefined) {
          let dx = (x2 - x1) * (link.x === undefined ? 0.5 : link.x);
          x1 += getWidth() / 2;
          x2 += getWidth() / 2;
          if (!reversed()) {
            y1 += getHeight();
            y2 += getHeight();
          }
          drawPath(container, x1, y1, x2, y2, dx, dy, dy, {class: link.class});
        }
        else if (link.type == "closeUnion") {
          // This should be used only for same-level nodes that are next to each other
          x1 += getWidth();
          y1 += getHeight() / 2;
          y2 += getHeight() / 2;
          drawCircle(container, (x1 + x2) / 2, (y1 + y2) / 2);
          drawLine(container, x1, y1, x2, y2, {class: link.class});
        }
        else if (link.type == "descent" || link.type == "siblingDescent" && (
          typeof link.start == "object" && Node.get(link.start[0]).children.length == 0 && Node.get(link.start[1]).children.length == 0 ||
          typeof link.start != "object" && Node.get(link.start).children.length == 0)
        ) {
          let dx = (x2 - x1) * (link.x === undefined ? 0.5 : link.x);
          x1 += getWidth() / 2;
          x2 += getWidth() / 2;
          if (!reversed()) {
            y1 += getHeight();
          }
          else {
            y2 += getHeight();
          }
          let dy1 = dy;
          let dy2 = -dy;
          if (typeof link.start == "object") {
            dy1 += reversed() ? -getHeight() / 2 : getHeight() / 2;
          }
          drawPath(container, x1, y1, x2, y2, dx, dy1, dy2, {class: link.class});
        }
        else if (link.type == "siblingDescent") {
          x2 += getWidth() / 2;
          if (!reversed()) {
            y1 += getHeight();
          }
          else {
            y2 += getHeight();
          }
          let siblings;
          if (typeof link.start == "object") {
            siblings = Node.get(link.start[0]).isKin() ? Node.get(link.start[1]).children : Node.get(link.start[0]).children;
            dy += reversed() ? -getHeight() / 2 : getHeight() / 2;
          }
          else {
            siblings = Node.get(link.start).children;
          }
          if (Node.get(link.end).getCoord()[0] < siblings[0].getCoord()[0]) {
            x1 = siblings[0].getCoord()[0] + getWidth() / 2;
          }
          else if (Node.get(link.end).getCoord()[0] > siblings.at(-1).getCoord()[0]) {
            x1 = siblings.at(-1).getCoord()[0] + getWidth() / 2;
          }
          else {
            drawLine(container, x2, y1 + dy, x2, y2, {class: link.class});
            continue;
          }
          drawPath(container, x1, y1 + dy, x2, y2, x2 - x1, 0, 0, {class: link.class});
        }
        else {
          console.warn(`Unknown link type: '${link.type}'`);
        }
      }

      return replacements;
    }

    function getNodes(node, depth, skips={}) {
      /* Return kin nodes at specified depth, grouped by kin parent node */
      if (depth == 0) {
        return [[node]];
      }
      else if (depth == 1) {
        if (node.skips > 0 && !skips[node.id]) return [[new PseudoNode(node, node.skips)]];
        const children = node.getChildren().map(x => x.skips == 0 || skips[x.id] ? x : new PseudoNode(x, x.skips));
        return children.length > 0 ? [children] : [];
      }
      else {
        let ret = [];
        for (let child of node.getChildren()) {
          if (child.skips > 0 && !skips[child.id]) {
            skips[child.id] = true;
            ret = ret.concat(getNodes(new PseudoNode(child, child.skips), depth - 1, skips));
          }
          else {
            ret = ret.concat(getNodes(child, depth - 1, skips));
          }
        }
        return ret;
      }
    }

    function computePosition(node) {
      // Align parent in regard to their children
      if (!node.hasChildren()) {
        return null;
      }
      const children = node.getChildren();
      let nodeWidth = node.getSize();
      const align = node.align || options.align;
      if (align == "left") {
        return children[0].getX();
      }
      else if (align == "right") {
        return children.at(-1).getX() + children.at(-1).getSize() - nodeWidth;
      }
      else {
        let delta = 0;
        if (node.isRemarried() && (!node.spouses[0].hasChildren() || !node.spouses[1].hasChildren()) ||
            node.isMarried() && !node.spouses[0].hasChildren() && node.children.length > 0) {
          // Ignore the childless spouse for positioning
          nodeWidth -= getWidth() + options.spouseMargin;
          if (node.isRemarried() && !node.spouses[0].hasChildren() || !node.isRemarried() && node.spouses[0].before)
            delta = getWidth() + options.spouseMargin;
        }
        return (children[0].getCoord()[0] + children.at(-1).getCoord()[0] + getWidth()) / 2 - (delta + nodeWidth / 2);
      }
    }

    function adjustPositions(depth) {
      /* Correctly position nodes at specified level, so that
       * margins are respected but no space is lost */
      let y = depth * (getHeight() + options.parentMargin);
      if (reversed()) y = -y;

      let basePos = 0;
      let currentShift = 0;
      let anchored = false;
      const levelNodes = getNodes(rootNode, depth);

      for (let [index, nodes] of levelNodes.entries()) {
        if (currentShift) {
          for (let node of nodes) node.translate(currentShift);
        }
        const positions = nodes.map(computePosition);
        let start = 0;
        while (start < positions.length) {
          let end = start;
          let foundAnchor = false;
          // Iterate until we find the first anchored sibling (relative to their children)
          for (let i=start; i<positions.length; i++) {
            if (positions[i] !== null) {
              end = i;
              foundAnchor = true;
              break;
            }
          }
          if (!foundAnchor) end = positions.length;
          let widthSum = 0;
          for (let i=start; i<end; i++) {
            widthSum += nodes[i].getSize();
          }
          let collisionShift = 0;

          // Collision check
          let margin = (!anchored || !foundAnchor) ? options.siblingMargin : (positions[end] - widthSum - basePos + options.siblingMargin) / (end - start + 1);
          if (margin < options.siblingMargin) {
            collisionShift = (options.siblingMargin - margin) * (end - start + 1);
            margin = options.siblingMargin;
          }
          else if (start == 0) {
            // Always use siblingMargin, unless between two anchored siblings
            margin = options.siblingMargin;
          }

          if (start == 0 && foundAnchor) {
            let shift = positions[end];
            for (let i=end-1; i>=start; i--) {
              shift -= nodes[i].getSize() + margin;
              nodes[i].setCoord(shift + collisionShift, y);
            }
          }
          else {
            basePos += margin - options.siblingMargin;
            for (let i=start; i<end; i++) {
              nodes[i].setCoord(basePos, y);
              basePos += nodes[i].getSize() + margin;
            }
          }

          if (foundAnchor) {
            nodes[end].setCoord(positions[end], y);
            if (collisionShift) {
              // Move all next siblings to the right, with their descent
              for (let i=end; i<positions.length; i++) {
                nodes[i].translate(collisionShift);
                if (positions[i] !== null) positions[i] += collisionShift;
              }
            }
            if (!anchored) {
              anchored = true;

              if (index > 0) {
                // Reposition previous unanchored cousins to avoid losing space
                const latestCousin = levelNodes[index - 1].at(-1);
                const delta = levelNodes[index][0].getX() - options.cousinMargin - latestCousin.getX() - latestCousin.getSize();
                for (let i=0; i<index; i++) {
                  for (let node of levelNodes[i]) {
                    node.translate(delta);
                  }
                }
              }
            }
            basePos = positions[end] + nodes[end].getSize() + options.siblingMargin;
          }
          start = end + 1;
          currentShift += collisionShift;
        }
        basePos += options.cousinMargin - options.siblingMargin;
      }
    }

    for (let depth=rootNode.getDepth(); depth>=0; depth--) {
      adjustPositions(depth);
    }

    const nodeContainer = makeElement("g", {id: "nodes"});
    svg.append(nodeContainer);
    drawNodes(rootNode, nodeContainer);

    const linkContainer = makeElement("g", {id: "links"});
    svg.append(linkContainer);
    const linkReplace = drawExtraLinks(linkContainer);
    drawLinks(rootNode, linkContainer);

    const padding = 5;
    const bbox = svg.getBBox();
    svg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + 2 * padding} ${bbox.height + 2 * padding}`);
    svg.setAttribute("width", bbox.width + 2 * padding);
    svg.setAttribute("height", bbox.height + 2 * padding);
    // Translate half a pixel so that line borders end up at pixel boundaries
    svg.setAttribute("transform", "translate(0.5 0.5)");

    // Note that svg must have viewBox to the right value so that the calculations are consistent
    svg.querySelectorAll(".name").forEach(function(text) {
      text.removeAttribute("style");
      for (let size = options.fontSize; text.getBBox().width > options.width && size > 0; size--) {
        text.setAttribute("font-size", size);
      }
    });

    if (options.title) {
      svg.append(makeElement("text", {
        id: "title",
        x: bbox.x + (options.title.x || 0),
        y: bbox.y + (options.title.y || 0),
        fill: "black",
        "dominant-baseline": "hanging",
        "font-family": options.title.fontFamily,
        "font-size": options.title.fontSize || 30,
        "font-variant": options.title.fontVariant,
        "font-weight": options.title.fontWeight,
        cursor: "default"
      }, options.title.text));
    }

    if (options.emblem) {
      svg.append(makeElement("image", {
        id: "emblem",
        href: options.emblem.url,
        x: bbox.x + options.emblem.x || 0,
        y: bbox.y + options.emblem.y || 0,
        width: options.emblem.width
      }));
    }
  }

  function removeTree() {
    svg.getElementById("nodes").remove();
    svg.getElementById("links").remove();
    const title = svg.getElementById("title");
    if (title) title.remove();
    const emblem = svg.getElementById("emblem")
    if (emblem) emblem.remove();
  }

  function redrawTree() {
    removeTree();
    drawTree();
  }

  function serializeTree(node) {
    const obj = {id: node.id};
    const ret = [[obj]];
    for (let k of ["name", "text", "class", "url", "image", "align", "before", "skips", "virtual"]) {
      if (node[k]) obj[k] = node[k];
    }
    if (node.hasParents()) obj.parent = node.parents[0].id;
    if (node.isMarried() && !node.isKin()) obj.spouse = node.spouses[0].id;
    if (node.isKin()) {
      for (let spouse of node.spouses) {
        ret[0] = ret[0].concat(serializeTree(spouse)[0]);
      }
      for (let child of node.getChildren()) {
        for (let [level, serializedNodes] of serializeTree(child).entries()) {
          if (level + 1 < ret.length)
            ret[level + 1] = ret[level + 1].concat(serializedNodes);
          else
            ret[level + 1] = serializedNodes;
        }
      }
    }
    return ret;
  }

  function serializeSVG(callback) {
    const clone = svg.cloneNode(true);
    for (let button of clone.querySelectorAll(".buttons")) {
      button.remove();
    }
    const svgImages = clone.querySelectorAll("image");
    let remaining = svgImages.length;
    if (remaining == 0) {
      let xml = new XMLSerializer().serializeToString(clone);
      callback("data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml));
    }

    for (let svgImage of svgImages) {
      // Replace each image link by the corresponding base64 data
      const img = new Image();
      img.src = svgImage.getAttribute("href");
      img.onload = function() {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        try {
          svgImage.setAttribute("href", canvas.toDataURL("png", 1.0));
        }
        catch(e) {
          // Possible CORS-related error
        }
        if (--remaining == 0) {
          const xml = new XMLSerializer().serializeToString(clone);
          callback("data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml));
        }
      };
    }
  }

  function readBlobAsDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function loadFontsAsDataURI(fonts) {
    const promises = fonts.map(async ({family, url}) => {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const dataURL = await readBlobAsDataURL(blob);
      return {family, src: `url('${dataURL}')`};
    });
    return await Promise.all(promises);
  }

  async function loadFonts(fonts) {
    if (fonts.size == 0) return;

    let dataURLfonts;
    try {
      dataURLfonts = await loadFontsAsDataURI(fonts);
    }
    catch(e) {
      console.warn("Could not load fonts: " + e.message);
      return;
    }

    const style = document.createElement("style");
    style.setAttribute("id", "fonts");
    style.innerHTML = dataURLfonts.map(({family, src}) => {
      return `@font-face {font-family: "${family}"; src: ${src};}`;
    }).join("\n");

    svg.append(style);
  }

  const ret = {};
  ret.get = function(id) {
    return Node.get(id);
  };

  ret.add = function(obj) {
    new Node(obj);
    redrawTree();
  };

  ret.remove = function(id) {
    Node.get(id).remove();
    redrawTree();
  };

  ret.getOption = function(name) {
    return options[name];
  };

  ret.setOption = function(name, value) {
    options[name] = value;
    if (name == "root") {
      redefineRoot();
      redrawTree();
    }
    else {
      const fonts = initializeOptions();
      loadFonts(fonts).then(redrawTree);
    }
  };

  ret.exportJSON = function() {
    const json = JSON.stringify(serializeTree(rootNode).flat());
    navigator.clipboard.writeText(json);
  };

  ret.downloadPNG = function(filename) {
    const image = new Image();
    image.style.visibility = "hidden";
    document.body.append(image);
    image.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width = image.clientWidth;
      canvas.height = image.clientHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png", 1.0);
      a.download = filename;
      a.click();
      document.body.removeChild(image);
    };
    serializeSVG(function(src) {
      image.src = src;
    });
  };

  ret.downloadSVG = function(filename) {
    serializeSVG(function(src) {
      const a = document.createElement("a");
      a.href = src;
      a.download = filename;
      a.click();
    });
  };

  return ret;
}

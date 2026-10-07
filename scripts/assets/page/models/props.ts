/** Мелкие объекты: кукиш, записка Хозяина, конверт премии, колба калоида, слоповина, дебик, иконки UI. */
import * as THREE from "three";
import { at, ball, box, cyl, disc, group, type MatSpec, mesh, prism, ring, scaled } from "../kit";

/** Кукиш — местная валюта: сухая шишечка. Кольца чешуек сужаются к верхушке. */
export function buildKukish(): THREE.Group {
  const g = group();
  g.add(scaled(at(ball(0.07, 1, { ramp: "wood", bias: 0.8 }), 0, 0.12, 0), 0.9, 1.5, 0.9));
  const rings = [
    { y: 0.03, r: 0.075, n: 6 },
    { y: 0.08, r: 0.085, n: 7 },
    { y: 0.135, r: 0.078, n: 7 },
    { y: 0.185, r: 0.058, n: 6 },
    { y: 0.225, r: 0.034, n: 5 },
  ];
  rings.forEach((rg, i) => {
    for (let k = 0; k < rg.n; k++) {
      const a = (k / rg.n) * Math.PI * 2 + i * 0.45;
      const scale = mesh(new THREE.ConeGeometry(0.03, 0.06, 4), { ramp: "wood", bias: i % 2 === 0 ? -0.3 : 0.2 });
      // Порядок YXZ: сначала наклон кончика наружу (X), потом разворот по кругу (Y)
      scale.rotation.order = "YXZ";
      scale.rotation.set(1.1, Math.PI / 2 - a, 0);
      scale.position.set(Math.cos(a) * rg.r, rg.y, Math.sin(a) * rg.r);
      g.add(scale);
    }
  });
  g.add(at(cyl(0.012, 0.015, 0.05, 4, { ramp: "wood", bias: 1.2 }), 0, 0.275, 0, 0, 0, 0.3));
  return g;
}

/** Записка от Хозяина: сложенный листок с красной сургучной печатью. */
export function buildNote(): THREE.Group {
  const paper: MatSpec = { ramp: "paper" };
  const g = group(
    at(box(0.34, 0.012, 0.13, paper), 0, 0, -0.065, 0.18, 0, 0),
    at(box(0.34, 0.012, 0.13, { ramp: "paper", bias: 0.4 }), 0, 0, 0.065, -0.18, 0, 0),
    at(cyl(0.045, 0.045, 0.025, 8, { ramp: "red" }), 0.06, 0.03, 0.02),
    at(box(0.05, 0.01, 0.012, { ramp: "red", bias: 1 }), 0.06, 0.045, 0.02),
  );
  return g;
}

/** Конверт «Хозяин обещал премию» с золотой печатью. */
export function buildEnvelope(): THREE.Group {
  const paper: MatSpec = { ramp: "paper" };
  return group(
    at(box(0.42, 0.28, 0.02, paper), 0, 0, 0),
    at(prism(0.42, 0.17, 0.01, { ramp: "paper", bias: 0.5 }), 0, 0.14, 0.012),
    at(box(0.42, 0.04, 0.025, { ramp: "red" }), 0, -0.02, 0.005),
    at(cyl(0.045, 0.045, 0.02, 8, { ramp: "gold" }), 0, 0.0, 0.03, Math.PI / 2, 0, 0),
  );
}

/** Калоидный ускоритель: колба с зелёной жижей, из горлышка идут пузыри (фаза t). */
export function buildFlask(t: number): THREE.Group {
  const glass: MatSpec = { ramp: "glass" };
  const goo: MatSpec = { ramp: "crt", fixedShade: 1 };
  const g = group(
    at(ball(0.17, 1, goo), 0, 0.17, 0),
    at(scaled(ball(0.175, 1, glass), 1, 0.45, 1), 0, 0.28, 0),
    at(cyl(0.055, 0.06, 0.2, 6, glass), 0, 0.42, 0),
    at(ring(0.06, 0.015, 8, glass), 0, 0.52, 0, Math.PI / 2),
    at(ball(0.04, 0, { ramp: "glass", fixedShade: 0 }), -0.08, 0.3, 0.12),
    scaled(at(disc(0.2, 10, { ramp: "carpet", fixedShade: 3 }), 0, 0.001, 0), 1, 1, 0.7),
  );
  for (let i = 0; i < 3; i++) {
    const p = (t + i / 3) % 1;
    const r = 0.025 + 0.015 * Math.sin(p * Math.PI);
    g.add(at(ball(r, 0, { ramp: "crt", fixedShade: 0 }), Math.sin((p + i) * 5) * 0.04, 0.55 + p * 0.28, 0));
  }
  return g;
}

/** Слоповина: ведро с мятыми бумажками и потёками слизи. */
export function buildSlop(): THREE.Group {
  const steel: MatSpec = { ramp: "steel" };
  const g = group(
    scaled(at(disc(0.3, 10, { ramp: "carpet", fixedShade: 3 }), 0, 0.001, 0), 1, 1, 0.7),
    at(cyl(0.22, 0.17, 0.38, 8, steel), 0, 0.19, 0),
    at(ring(0.22, 0.02, 10, { ramp: "steel", bias: -0.6 }), 0, 0.38, 0, Math.PI / 2),
    at(ball(0.08, 0, { ramp: "paper" }), -0.07, 0.4, 0.02),
    at(ball(0.07, 0, { ramp: "paper", bias: 0.4 }), 0.08, 0.41, -0.04),
    at(ball(0.06, 0, { ramp: "paper" }), 0.02, 0.44, 0.08),
  );
  const slime: MatSpec = { ramp: "lime" };
  for (const [x, len] of [
    [-0.12, 0.16],
    [0.05, 0.24],
    [0.15, 0.11],
  ] as const) {
    g.add(scaled(at(ball(0.035, 0, slime), x, 0.37 - len / 2, 0.2), 1, len / 0.07, 0.6));
  }
  g.add(scaled(at(ball(0.05, 0, slime), 0.05, 0.12, 0.2), 1.3, 0.8, 0.7));
  return g;
}

/** Дебик: жучок-бухгалтерик с кукишем на спине. Бежит вдоль +x; t — фаза бега. */
export function buildDebik(t: number): THREE.Group {
  const shell: MatSpec = { ramp: "lime" };
  const dark: MatSpec = { ramp: "chitin", bias: 1 };
  const w = Math.PI * 2 * t;
  const bob = 0.02 * Math.abs(Math.sin(w));
  const body = group(
    scaled(at(ball(0.16, 1, shell), 0, 0.14, 0), 1.3, 0.75, 0.95),
    at(box(0.3, 0.02, 0.03, { ramp: "gold" }), 0, 0.26, 0),
    at(ball(0.075, 1, dark), 0.22, 0.13, 0),
  );
  body.position.y = bob;
  for (const s of [-1, 1]) {
    body.add(at(cyl(0.007, 0.009, 0.16, 3, dark), 0.26, 0.2, 0.04 * s, 0, 0, -0.8));
    body.add(at(cyl(0.007, 0.009, 0.12, 3, dark), 0.33, 0.28, 0.06 * s, 0.3 * s, 0, -0.2));
  }
  const kukish = buildKukish();
  kukish.scale.setScalar(0.7);
  kukish.position.set(-0.04, 0.22, 0);
  kukish.rotation.z = 0.25;
  body.add(kukish);
  const g = group(scaled(at(disc(0.24, 10, { ramp: "carpet", fixedShade: 3 }), 0, 0.001, 0), 1.3, 1, 0.7), body);
  // Трёхопорная походка насекомого: ноги 1-3-5 и 2-4-6 в противофазе
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      const phase = (i + (s > 0 ? 1 : 0)) % 2 === 0 ? 0 : Math.PI;
      const swing = 0.55 * Math.sin(w + phase);
      const leg = group(at(cyl(0.012, 0.01, 0.16, 3, dark), 0, -0.07, 0.04 * s));
      leg.position.set(-0.1 + i * 0.1, 0.12 + bob, 0.1 * s);
      leg.rotation.set(0.55 * s, 0, swing);
      g.add(leg);
    }
  }
  return g;
}

/**
 * Кредик: жук-ростовщик в полосатом пиджаке и с толстой золотой цепью,
 * держит мешок кукишей. Парит у края экрана; t — фаза покачивания.
 */
export function buildKredik(t: number): THREE.Group {
  const w = Math.PI * 2 * t;
  const shell: MatSpec = { ramp: "navy" };
  const dark: MatSpec = { ramp: "chitin", bias: 1 };
  const gold: MatSpec = { ramp: "gold" };
  const body = group(
    scaled(at(ball(0.2, 1, shell), 0, 0.3, 0), 1, 1.15, 0.8),
    at(box(0.012, 0.36, 0.012, { ramp: "studio" }), -0.07, 0.3, 0.165),
    at(box(0.012, 0.36, 0.012, { ramp: "studio" }), 0.07, 0.3, 0.165),
    at(box(0.08, 0.2, 0.02, { ramp: "shirt" }), 0, 0.4, 0.15),
    at(box(0.04, 0.16, 0.02, { ramp: "red" }), 0, 0.38, 0.165),
    at(ring(0.11, 0.018, 10, gold, Math.PI), 0, 0.48, 0.07, Math.PI * 0.85, 0, 0),
  );
  const head = group(
    scaled(at(ball(0.13, 1, { ramp: "chitin", bias: 0.6 }), 0, 0, 0), 1, 0.9, 0.9),
    scaled(at(ball(0.1, 1, { ramp: "chitin", bias: -1.1 }), 0, -0.01, 0.07), 0.85, 0.9, 0.35),
    // Тёмные очки и шляпа-котелок
    at(box(0.2, 0.04, 0.03, { ramp: "fabric", bias: 0.8 }), 0, 0.02, 0.12),
    at(cyl(0.16, 0.16, 0.02, 10, { ramp: "fabric" }), 0, 0.1, 0),
    scaled(at(ball(0.1, 1, { ramp: "fabric" }), 0, 0.14, 0), 1, 0.8, 1),
  );
  head.position.set(0, 0.62, 0.02);
  head.rotation.z = 0.08 * Math.sin(w);
  body.add(head);
  for (const s of [-1, 1]) {
    const ant = group(at(cyl(0.008, 0.01, 0.2, 3, dark), 0, 0.1, 0));
    ant.position.set(0.05 * s, 0.75, 0);
    ant.rotation.set(-0.3, 0, -0.5 * s + 0.15 * Math.sin(w + s));
    body.add(ant);
  }
  // Мешок кукишей в правой лапке, левая «зовёт»
  const bag = group(
    scaled(at(ball(0.11, 1, { ramp: "cardboard", bias: -0.3 }), 0, 0, 0), 1, 0.95, 1),
    at(cyl(0.03, 0.05, 0.05, 6, { ramp: "cardboard", bias: 0.5 }), 0, 0.11, 0),
    at(cyl(0.035, 0.035, 0.02, 6, gold), 0, 0.14, 0),
  );
  body.add(at(bag, 0.25, 0.18, 0.05));
  body.add(at(cyl(0.022, 0.018, 0.22, 4, dark), 0.2, 0.32, 0.03, 0, 0, 0.6));
  body.add(at(cyl(0.022, 0.018, 0.22, 4, dark), -0.22, 0.42, 0.05, 0, 0, -1.2 - 0.3 * Math.sin(w * 2)));
  body.position.y = 0.04 * Math.sin(w);
  return group(scaled(at(disc(0.2, 10, { ramp: "fabric", fixedShade: 3 }), 0, 0.001, 0), 1, 1, 0.6), body);
}

export type IconKind =
  | "hire"
  | "cards"
  | "board"
  | "settings"
  | "stamp"
  | "tasks"
  | "lift"
  | "inspect"
  | "clock"
  | "diploma"
  | "equip";

/** Иконки интерфейса. */
export function buildIcon(kind: IconKind): THREE.Group {
  switch (kind) {
    case "hire": {
      const chitin: MatSpec = { ramp: "chitin" };
      const g = group(
        at(cyl(0.22, 0.26, 0.2, 6, { ramp: "shirt" }), 0, 0.1, 0),
        at(box(0.06, 0.16, 0.02, { ramp: "blue" }), 0, 0.12, 0.2),
        at(cyl(0.06, 0.07, 0.08, 5, chitin), 0, 0.24, 0),
        scaled(at(ball(0.16, 1, chitin), 0, 0.42, 0), 0.95, 1.15, 0.92),
        scaled(at(ball(0.13, 1, { ramp: "chitin", bias: -1.3 }), 0, 0.41, 0.09), 0.82, 1, 0.38),
      );
      for (const s of [-1, 1]) {
        g.add(at(cyl(0.012, 0.014, 0.22, 4, { ramp: "chitin", bias: 1 }), 0.09 * s, 0.66, -0.02, -0.4, 0, -0.4 * s));
        g.add(at(ball(0.024, 0, { ramp: "chitin", bias: 1 }), 0.14 * s, 0.76, -0.07));
      }
      return g;
    }
    case "cards": {
      const g = group(
        at(box(0.5, 0.26, 0.34, { ramp: "cardboard" }), 0, 0.13, 0),
        at(box(0.46, 0.02, 0.3, { ramp: "cardboard", bias: 1 }), 0, 0.27, 0),
      );
      for (let i = 0; i < 5; i++) {
        g.add(at(box(0.42, 0.18, 0.012, { ramp: "paper", bias: i % 2 === 0 ? 0 : 0.4 }), 0, 0.31, -0.12 + i * 0.06, -0.1));
      }
      g.add(at(box(0.08, 0.06, 0.014, { ramp: "red" }), 0.12, 0.42, 0.0, -0.1));
      return g;
    }
    case "board": {
      const g = group(
        at(box(0.62, 0.46, 0.04, { ramp: "wood", bias: 0.4 }), 0, 0.3, 0),
        at(box(0.54, 0.38, 0.045, { ramp: "cardboard" }), 0, 0.3, 0.005),
        at(box(0.18, 0.22, 0.012, { ramp: "paper" }), -0.15, 0.32, 0.03, 0, 0, 0.08),
        at(box(0.16, 0.12, 0.012, { ramp: "paper", bias: 0.4 }), 0.14, 0.2, 0.03, 0, 0, -0.1),
        at(ball(0.02, 0, { ramp: "red" }), -0.15, 0.42, 0.045),
        at(ball(0.02, 0, { ramp: "blue" }), 0.14, 0.26, 0.045),
      );
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.1 : 0.045;
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      star.closePath();
      const starMesh = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), { ramp: "gold" });
      g.add(at(starMesh, 0.14, 0.4, 0.03));
      return g;
    }
    case "settings": {
      const steel: MatSpec = { ramp: "steel" };
      const g = group(at(cyl(0.2, 0.2, 0.08, 12, steel), 0, 0, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(at(box(0.08, 0.08, 0.08, steel), Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23, 0, -a, 0));
      }
      g.add(at(cyl(0.07, 0.07, 0.1, 8, { ramp: "fabric" }), 0, 0.002, 0));
      g.rotation.x = Math.PI / 2 - 0.35;
      g.position.y = 0.3;
      return group(g);
    }
    case "stamp": {
      // Печать отдела квадров — валюта перков
      const gold: MatSpec = { ramp: "gold" };
      return group(
        at(cyl(0.24, 0.24, 0.08, 12, { ramp: "red" }), 0, 0.04, 0),
        at(cyl(0.2, 0.2, 0.01, 12, { ramp: "red", bias: -0.6 }), 0, 0.085, 0),
        at(cyl(0.07, 0.11, 0.2, 8, gold), 0, 0.18, 0),
        at(ball(0.11, 1, gold), 0, 0.34, 0),
      );
    }
    case "tasks": {
      // Планшет с поручениями Тоси Боси и галочками
      const g = group(
        at(box(0.42, 0.56, 0.03, { ramp: "wood", bias: 0.3 }), 0, 0.3, 0),
        at(box(0.36, 0.46, 0.012, { ramp: "paper" }), 0, 0.28, 0.02),
        at(box(0.16, 0.06, 0.05, { ramp: "steel" }), 0, 0.57, 0.02),
      );
      for (let i = 0; i < 3; i++) {
        const y = 0.44 - i * 0.13;
        g.add(at(box(0.06, 0.06, 0.012, { ramp: i < 2 ? "green" : "paper", bias: i < 2 ? 0 : 0.8 }), -0.11, y, 0.03));
        g.add(at(box(0.18, 0.025, 0.012, { ramp: "slate" }), 0.06, y, 0.03));
      }
      return g;
    }
    case "lift": {
      // Двери лифта и табло со стрелками
      const steel: MatSpec = { ramp: "steel" };
      return group(
        at(box(0.56, 0.62, 0.05, { ramp: "steel", bias: 0.6 }), 0, 0.31, 0),
        at(box(0.22, 0.52, 0.02, steel), -0.115, 0.27, 0.03),
        at(box(0.22, 0.52, 0.02, steel), 0.115, 0.27, 0.03),
        at(box(0.16, 0.08, 0.02, { ramp: "fabric" }), 0, 0.58, 0.03),
        at(prism(0.06, 0.05, 0.01, { ramp: "hazard", fixedShade: 0 }), -0.035, 0.555, 0.045, 0, 0, Math.PI),
        at(prism(0.06, 0.05, 0.01, { ramp: "hazard", fixedShade: 0 }), 0.035, 0.605, 0.045),
      );
    }
    case "inspect": {
      // Лупа «проверки сверху»
      const g = group(
        at(ring(0.17, 0.035, 12, { ramp: "fabric" }), 0, 0.4, 0),
        at(cyl(0.16, 0.16, 0.01, 12, { ramp: "glass", fixedShade: 1 }), 0, 0.4, 0, Math.PI / 2),
        at(ball(0.04, 0, { ramp: "glass", fixedShade: 0 }), -0.06, 0.46, 0.02),
        at(cyl(0.035, 0.04, 0.26, 6, { ramp: "wood" }), 0.19, 0.12, 0, 0, 0, 0.75),
      );
      return g;
    }
    case "clock": {
      // Настенные часы смены
      const g = group(
        at(cyl(0.26, 0.26, 0.06, 14, { ramp: "red" }), 0, 0.32, 0, Math.PI / 2),
        at(cyl(0.22, 0.22, 0.01, 14, { ramp: "paper" }), 0, 0.32, 0.035, Math.PI / 2),
        at(box(0.025, 0.15, 0.01, { ramp: "fabric" }), 0, 0.38, 0.045),
        at(box(0.11, 0.025, 0.01, { ramp: "fabric" }), 0.05, 0.32, 0.045),
      );
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.add(at(box(0.02, 0.02, 0.01, { ramp: "fabric" }), Math.cos(a) * 0.18, 0.32 + Math.sin(a) * 0.18, 0.045));
      }
      g.add(at(ball(0.035, 0, { ramp: "gold" }), 0.18, 0.56, 0));
      g.add(at(ball(0.035, 0, { ramp: "gold" }), -0.18, 0.56, 0));
      return g;
    }
    case "diploma": {
      // Квалификация найма: свиток с лентой и печатью
      return group(
        at(cyl(0.07, 0.07, 0.5, 8, { ramp: "paper" }), 0, 0.2, 0, 0, 0, Math.PI / 2 - 0.3),
        at(cyl(0.075, 0.075, 0.06, 8, { ramp: "red" }), 0, 0.2, 0, 0, 0, Math.PI / 2 - 0.3),
        at(box(0.04, 0.16, 0.01, { ramp: "red" }), -0.03, 0.08, 0.07, 0, 0, 0.3),
        at(box(0.04, 0.16, 0.01, { ramp: "red" }), 0.03, 0.08, 0.07, 0, 0, -0.3),
        at(cyl(0.05, 0.05, 0.02, 8, { ramp: "gold" }), 0.05, 0.25, 0.08, Math.PI / 2),
      );
    }
    case "equip": {
      // Оснащение: монитор с зелёной стрелкой вверх
      return group(
        at(box(0.48, 0.34, 0.05, { ramp: "plastic" }), 0, 0.32, 0),
        at(box(0.4, 0.26, 0.01, { ramp: "crt", fixedShade: 2 }), 0, 0.33, 0.03),
        at(box(0.06, 0.12, 0.05, { ramp: "plastic", bias: 0.4 }), 0, 0.1, 0),
        at(box(0.24, 0.03, 0.14, { ramp: "plastic" }), 0, 0.03, 0),
        at(prism(0.18, 0.1, 0.02, { ramp: "crt", fixedShade: 0 }), 0, 0.39, 0.035, 0, 0, Math.PI),
        at(box(0.07, 0.1, 0.02, { ramp: "crt", fixedShade: 0 }), 0, 0.31, 0.035),
      );
    }
  }
}

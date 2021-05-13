/* eslint-disable no-case-declarations */
/**
 * The Pathfinder 1st edition game system for Foundry Virtual Tabletop
 * Author: Furyspark
 * Software License: GNU GPLv3
 */

// Import Modules
import { PF1, CONFIG_OVERRIDES } from "./module/config.js";
import { registerSystemSettings, registerClientSettings, migrateSystemSettings } from "./module/settings.js";
import { preloadHandlebarsTemplates } from "./module/handlebars/templates.js";
import { registerHandlebarsHelpers } from "./module/handlebars/helpers.js";
import { tinyMCEInit } from "./module/mce/mce.js";
import { measureDistances, getConditions } from "./module/canvas.js";
import { ActorPF } from "./module/actor/entity.js";
import { ActorSheetPF } from "./module/actor/sheets/base.js";
import { ActorSheetPFCharacter } from "./module/actor/sheets/character.js";
import { ActorSheetPFNPC } from "./module/actor/sheets/npc.js";
import { ActorSheetPFNPCLite } from "./module/actor/sheets/npc-lite.js";
import { ActorSheetPFNPCLoot } from "./module/actor/sheets/npc-loot.js";
import { ActorSheetFlags } from "./module/apps/actor-flags.js";
import { ActorRestDialog } from "./module/apps/actor-rest.js";
import { EntrySelector } from "./module/apps/entry-selector.js";
import { LevelUpForm } from "./module/apps/level-up.js";
import { PointBuyCalculator } from "./module/apps/point-buy-calculator.js";
import { ScriptEditor } from "./module/apps/script-editor.js";
import { SidebarPF } from "./module/apps/sidebar.js";
import { ActorTraitSelector } from "./module/apps/trait-selector.js";
import { ActiveEffectPF } from "./module/ae/entity.js";
import { ItemPF } from "./module/item/entity.js";
import { ItemSheetPF } from "./module/item/sheets/base.js";
import { ItemSheetPF_Container } from "./module/item/sheets/container.js";
import { getChangeFlat, getSourceInfo } from "./module/actor/apply-changes.js";
import { CompendiumDirectoryPF } from "./module/sidebar/compendium.js";
import { CompendiumBrowser } from "./module/apps/compendium-browser.js";
import { PatchCore } from "./module/patch-core.js";
import { DicePF } from "./module/dice.js";
import { RollPF } from "./module/roll.js";
import {
  getItemOwner,
  sizeDieExt,
  sizeReach,
  normalDie,
  getActorFromId,
  createTag,
  createTabs,
  convertWeight,
  convertWeightBack,
  convertDistance,
  getBuffTargets,
  getBuffTargetDictionary,
} from "./module/lib.js";
import { ChatMessagePF, customRolls } from "./module/sidebar/chat-message.js";
import { ChatAttack } from "./module/misc/chat-attack.js";
import { TokenQuickActions } from "./module/token-quick-actions.js";
import { initializeSocket } from "./module/socket.js";
import { SemanticVersion } from "./module/semver.js";
import { runUnitTests } from "./module/unit-tests.js";
import { ChangeLogWindow } from "./module/apps/change-log.js";
import { PF1_HelpBrowser } from "./module/apps/help-browser.js";
import { addReachCallback, measureReachDistance } from "./module/misc/attack-reach.js";
import { TooltipPF } from "./module/hud/tooltip.js";
import { dialogGetNumber, dialogGetActor } from "./module/dialog.js";
import * as chat from "./module/chat.js";
import * as migrations from "./module/migration.js";
import * as macros from "./module/macros.js";
import { addLowLightVisionToLightConfig, addLowLightVisionToTokenConfig } from "./module/low-light-vision.js";
import { initializeModules } from "./module/modules.js";
import { ItemChange } from "./module/item/components/change.js";
import { Widget_CategorizedItemPicker } from "./module/widgets/categorized-item-picker.js";
import { CurrencyTransfer } from "./module/apps/currency-transfer.js";

// Add String.format
if (!String.prototype.format) {
  String.prototype.format = function (...args) {
    return this.replace(/{(\d+)}/g, function (match, number) {
      return args[number] != null ? args[number] : match;
    });
  };
}

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", function () {
  console.log(`PF1 | Initializing Pathfinder 1 System`);

  // Register client settings
  registerClientSettings();

  // Create a PF1 namespace within the game global
  game.pf1 = {
    documents: { ActorPF, ItemPF },
    entities: { ActorPF, ItemPF },
    applications: {
      // Actors
      ActorSheetPF,
      ActorSheetPFCharacter,
      ActorSheetPFNPC,
      ActorSheetPFNPCLite,
      ActorSheetPFNPCLoot,
      // Items
      ItemSheetPF,
      ItemSheetPF_Container,
      // Misc
      ActorSheetFlags,
      ActorRestDialog,
      ActorTraitSelector,
      CompendiumDirectoryPF,
      CompendiumBrowser,
      EntrySelector,
      LevelUpForm,
      PointBuyCalculator,
      ScriptEditor,
      SidebarPF,
      TooltipPF,
      PF1_HelpBrowser,
      // Widgets
      Widget_CategorizedItemPicker,
      CurrencyTransfer,
    },
    compendiums: {},
    // Rolling
    DicePF,
    rollPreProcess: {
      sizeRoll: sizeDieExt,
      sizeReach: sizeReach,
      roll: normalDie,
    },
    //Chat
    chat: { ChatAttack, ChatMessagePF },
    // Utility
    utils: {
      createTag,
      createTabs,
      getItemOwner,
      getActorFromId,
      getChangeFlat,
      getSourceInfo,
      convertDistance,
      convertWeight,
      convertWeightBack,
      measureDistances,
      measureReachDistance,
      dialogGetActor,
      dialogGetNumber,
      SemanticVersion,
    },
    // Components
    documentComponents: {
      ItemChange,
    },
    // Macros
    macros,
    rollItemMacro: macros.rollItemMacro,
    rollSkillMacro: macros.rollSkillMacro,
    rollDefenses: macros.rollDefenses,
    rollActorAttributeMacro: macros.rollActorAttributeMacro,
    // Migrations
    migrations,
    migrateWorld: migrations.migrateWorld,
    isMigrating: false,
    // Misc
    config: PF1,
    tooltip: null,
    runUnitTests,
    // Function library
    functions: {
      getBuffTargets,
      getBuffTargetDictionary,
    },
  };

  // Global exports
  globalThis.RollPF = RollPF;

  // Record Configuration Values
  CONFIG.PF1 = PF1;
  mergeObject(CONFIG, CONFIG_OVERRIDES);
  CONFIG.Actor.entityClass = ActorPF;
  CONFIG.ActiveEffect.entityClass = ActiveEffectPF;
  CONFIG.Item.entityClass = ItemPF;
  CONFIG.ui.compendium = CompendiumDirectoryPF;
  CONFIG.ChatMessage.entityClass = ChatMessagePF;
  CONFIG.Dice.rolls[0] = RollPF;

  // Register System Settings
  registerSystemSettings();

  //Calculate conditions for world
  CONFIG.statusEffects = getConditions();

  // Preload Handlebars Templates
  preloadHandlebarsTemplates();
  registerHandlebarsHelpers();

  // Patch Core Functions
  PatchCore();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("PF1", ActorSheetPFCharacter, { types: ["character"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPC, { types: ["npc"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPCLite, { types: ["npc"], makeDefault: false });
  Actors.registerSheet("PF1", ActorSheetPFNPCLoot, { types: ["npc"], makeDefault: false });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("PF1", ItemSheetPF, {
    types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack", "race"],
    makeDefault: true,
  });
  Items.registerSheet("PF1", ItemSheetPF_Container, { types: ["container"], makeDefault: true });

  // Initialize socket listener
  initializeSocket();

  // Initialize module integrations
  initializeModules();
});

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = [
    "abilities",
    "abilitiesShort",
    "alignments",
    "currencies",
    "distanceUnits",
    "itemActionTypes",
    "senses",
    "skills",
    "targetTypes",
    "timePeriods",
    "savingThrows",
    "ac",
    "acValueLabels",
    "featTypes",
    "conditions",
    "lootTypes",
    "flyManeuverabilities",
    "abilityTypes",
    "spellPreparationModes",
    "weaponTypes",
    "weaponProperties",
    "spellComponents",
    "spellSchools",
    "spellLevels",
    "conditionTypes",
    "favouredClassBonuses",
    "armorProficiencies",
    "weaponProficiencies",
    "actorSizes",
    "abilityActivationTypes",
    "abilityActivationTypesPlurals",
    "limitedUsePeriods",
    "equipmentTypes",
    "equipmentSlots",
    "consumableTypes",
    "attackTypes",
    "buffTypes",
    // "buffTargets",
    // "contextNoteTargets",
    "healingTypes",
    "divineFocus",
    "classSavingThrows",
    "classBAB",
    "classTypes",
    "measureTemplateTypes",
    "creatureTypes",
    "measureUnits",
    "measureUnitsShort",
    "languages",
    "damageTypes",
    "weaponHoldTypes",
    "auraStrengths",
    "conditionalTargets",
    "bonusModifiers",
    "abilityActivationTypes_unchained",
    "abilityActivationTypesPlurals_unchained",
    "actorStatures",
  ];

  // Config (sub-)objects to be sorted
  const toSort = [
    // "buffTargets",
    // "buffTargets.misc",
    // "contextNoteTargets",
    // "contextNoteTargets.misc",
    "skills",
    "conditions",
    "conditionTypes",
    "consumableTypes",
    "creatureTypes",
    "featTypes",
    "weaponProperties",
    "spellSchools",
    "languages",
    "damageTypes",
  ];

  /**
   * Helper function to recursively localize object entries
   *
   * @param {object} obj - The object to be localized
   * @param {string} cat - The object's name
   * @returns {object} The localized object
   */
  const doLocalize = (obj, cat) => {
    // Create tuples of (key, localized object/string)
    const localized = Object.entries(obj).reduce((arr, e) => {
      if (typeof e[1] === "string") arr.push([e[0], game.i18n.localize(e[1])]);
      else if (typeof e[1] === "object") arr.push([e[0], doLocalize(e[1], `${cat}.${e[0]}`)]);
      return arr;
    }, []);
    if (toSort.includes(cat)) {
      // Sort simple strings, fall back to sorting by label for objects/categories
      localized.sort((a, b) => {
        const localA = typeof a?.[1] === "string" ? a[1] : a[1]?._label;
        const localB = typeof b?.[1] === "string" ? b[1] : b[1]?._label;
        // Move misc to bottom of every list
        if (a[0] === "misc") return 1;
        else if (b[0] === "misc") return -1;
        // Regular sorting of localized strings
        return localA.localeCompare(localB);
      });
    }
    // Get the localized and sorted object out of tuple
    return localized.reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, {});
  };

  // Localize and sort CONFIG objects
  for (const o of toLocalize) {
    CONFIG.PF1[o] = doLocalize(CONFIG.PF1[o], o);
  }

  // Localize buff targets
  const localizeLabels = ["buffTargets", "buffTargetCategories", "contextNoteTargets", "contextNoteCategories"];
  for (let l of localizeLabels) {
    for (let [k, v] of Object.entries(CONFIG.PF1[l])) {
      CONFIG.PF1[l][k].label = game.i18n.localize(v.label);
    }
  }

  // TinyMCE variables and commands
  tinyMCEInit();
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function () {
  // Create tooltip
  game.pf1.tooltip = new TooltipPF();
  window.addEventListener("resize", () => {
    game.pf1.tooltip.setPosition();
  });
  window.addEventListener("keydown", (event) => {
    const tooltipConfig = game.settings.get("pf1", "tooltipConfig");
    if (event.key === "Shift" && game.user.isGM) {
      game.pf1.tooltip.forceHideGMInfo = true;
      game.pf1.tooltip.render();
    } else if (event.key === "Control") {
      if (tooltipConfig.hideWithoutKey) {
        game.pf1.tooltip.show();
      } else {
        game.pf1.tooltip.hide();
      }
    }
  });
  window.addEventListener("keyup", (event) => {
    const tooltipConfig = game.settings.get("pf1", "tooltipConfig");
    if (event.key === "Shift" && game.user.isGM) {
      game.pf1.tooltip.forceHideGMInfo = false;
      game.pf1.tooltip.render();
    } else if (event.key === "Control") {
      if (tooltipConfig.hideWithoutKey) {
        game.pf1.tooltip.hide();
      } else {
        game.pf1.tooltip.show();
      }
    }
  });

  // Migrate data
  const NEEDS_MIGRATION_VERSION = "0.77.22";
  let PREVIOUS_MIGRATION_VERSION = game.settings.get("pf1", "systemMigrationVersion");
  if (typeof PREVIOUS_MIGRATION_VERSION === "number") {
    PREVIOUS_MIGRATION_VERSION = PREVIOUS_MIGRATION_VERSION.toString() + ".0";
  } else if (
    typeof PREVIOUS_MIGRATION_VERSION === "string" &&
    PREVIOUS_MIGRATION_VERSION.match(/^([0-9]+)\.([0-9]+)$/)
  ) {
    PREVIOUS_MIGRATION_VERSION = `${PREVIOUS_MIGRATION_VERSION}.0`;
  }
  let needMigration = SemanticVersion.fromString(NEEDS_MIGRATION_VERSION).isHigherThan(
    SemanticVersion.fromString(PREVIOUS_MIGRATION_VERSION)
  );
  if (needMigration && game.user.isGM) {
    // await migrations.migrateWorld();
  }

  // Migrate system settings
  await migrateSystemSettings();

  // Create compendium browsers
  game.pf1.compendiums = {
    spells: new CompendiumBrowser({ type: "spells" }),
    items: new CompendiumBrowser({ type: "items" }),
    bestiary: new CompendiumBrowser({ type: "bestiary" }),
    feats: new CompendiumBrowser({ type: "feats" }),
    classes: new CompendiumBrowser({ type: "classes" }),
    races: new CompendiumBrowser({ type: "races" }),
    buffs: new CompendiumBrowser({ type: "buffs" }),
  };

  // Show changelog
  if (!game.settings.get("pf1", "dontShowChangelog")) {
    const v = game.settings.get("pf1", "changelogVersion") || "0.0.1";
    const changelogVersion = SemanticVersion.fromString(v);
    const curVersion = SemanticVersion.fromString(game.system.data.version);

    if (curVersion.isHigherThan(changelogVersion)) {
      const app = new ChangeLogWindow(changelogVersion);
      app.render(true);
      game.settings.set("pf1", "changelogVersion", curVersion.toString());
    }
  }

  Hooks.on("renderTokenHUD", (app, html, data) => {
    TokenQuickActions.addTop3Attacks(app, html, data);
  });
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function () {
  // Extend Diagonal Measurement
  canvas.grid.diagonalRule = game.settings.get("pf1", "diagonalMovement");
  SquareGrid.prototype.measureDistances = measureDistances;
});

{
  let callbacks = [];

  Hooks.on("canvasReady", () => {
    // Remove old reach callbacks
    for (let cb of callbacks) {
      cb.elem.off(cb.event, cb.callback);
    }

    // Add reach measurements
    game.messages.forEach((m) => {
      const elem = $(`#chat .chat-message[data-message-id="${m.data._id}"]`);
      if (!elem || (elem && !elem.length)) return;
      const results = addReachCallback(m.data, elem);
      callbacks.push(...results);
    });

    // Toggle token condition icons
    if (game.user.isGM) {
      canvas.tokens.placeables.forEach((t) => {
        if (t.actor) t.actor.toggleConditionStatusIcons();
      });
    }
  });

  Hooks.on("renderChatMessage", (app, html, data) => {
    // Wait for setup after this
    if (!game.ready) return;

    // Add reach measurements on hover
    const results = addReachCallback(data.message, html);
    callbacks.push(...results);
  });
}

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (app, html, data) => {
  // Hide roll info
  chat.hideRollInfo(app, html, data);

  // Hide GM sensitive info
  chat.hideGMSensitiveInfo(app, html, data);

  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();

  // Optionally hide chat buttons
  if (game.settings.get("pf1", "hideChatButtons")) html.find(".card-buttons").hide();

  // Apply accessibility settings to chat message
  chat.applyAccessibilitySettings(app, html, data, game.settings.get("pf1", "accessibilityConfig"));

  // Alter chat card title color
  chat.addChatCardTitleGradient(app, html, data);

  // Handle chat tooltips
  html.find(".tooltip").on("mousemove", (ev) => handleChatTooltips(ev));
});

Hooks.on("renderChatPopout", (app, html, data) => {
  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();

  // Optionally hide chat buttons
  if (game.settings.get("pf1", "hideChatButtons")) html.find(".card-buttons").hide();
});

Hooks.on("renderChatLog", (_, html) => ItemPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => ActorPF.chatListeners(html));

Hooks.on("renderChatPopout", (_, html) => ItemPF.chatListeners(html));
Hooks.on("renderChatPopout", (_, html) => ActorPF.chatListeners(html));

Hooks.on("renderLightConfig", (app, html) => {
  addLowLightVisionToLightConfig(app, html);
});

Hooks.on("updateOwnedItem", (actor, itemData, changedData, options, userId) => {
  if (!(actor instanceof Actor)) return;
  const item = actor.getOwnedItem(changedData._id);
  if (item == null) return;

  // Toggle buff
  if (item.type === "buff" && getProperty(changedData, "data.active") !== undefined) {
    // Call hook
    Hooks.callAll("pf1.toggleActorBuff", actor, item.data, getProperty(changedData, "data.active"));
  }

  if (userId !== game.user.id) return;

  // Update level
  (async () => {
    // Alter level-based class data
    if (item.type === "class" && hasProperty(changedData, "data.level")) {
      const prevLevel = getProperty(item.data, "data.level");
      const newLevel = getProperty(changedData, "data.level");
      await item._onLevelChange(prevLevel, newLevel);
    }
  })();
});

Hooks.on("updateActor", (actor, data, options, userId) => {
  // Call hook for toggling conditions
  {
    const conditions = getProperty(data, "data.attributes.conditions") || {};
    for (let [k, v] of Object.entries(conditions)) {
      Hooks.callAll("pf1.toggleActorCondition", actor, k, v);
    }
  }
});

Hooks.on("createToken", (scene, token, options, userId) => {
  if (userId !== game.user._id) return;

  const actor = game.actors.tokens[token._id] ?? game.actors.get(token.actorId);

  // Update changes and generate sourceDetails to ensure valid actor data
  if (actor != null) {
    actor.toggleConditionStatusIcons();
  }
});

Hooks.on("preCreateToken", async (scene, token, options, userId) => {
  const actor = game.actors.get(token.actorId),
    buffTextures = Object.values(actor?._calcBuffTextures() ?? []).map((b) => b.icon);
  for (let icon of buffTextures) await loadTexture(icon);
});

Hooks.on("hoverToken", (token, hovering) => {
  // Show token tooltip
  if (hovering && !game.keyboard.isDown("Alt")) {
    const p = game.pf1.tooltip.mousePos;
    const el = document.elementFromPoint(p.x, p.y);
    // This check is required to prevent hovering over tokens under application windows
    if (el.id === "board") {
      game.pf1.tooltip.bind(token);
    }
  }
  // Hide token tooltip
  else game.pf1.tooltip.unbind(token);
});

Hooks.on("preDeleteToken", (scene, data, options, userId) => {
  const token = canvas.tokens.placeables.find((t) => t.data._id === data._id);
  if (!token) return;

  // Hide token tooltip on token deletion
  game.pf1.tooltip.unbind(token);
});

Hooks.on("updateToken", (scene, data, updateData, options, userId) => {
  const token = canvas.tokens.placeables.find((t) => t.data._id === data._id);
  if (!token) return;

  // Hide token tooltip on token update
  game.pf1.tooltip.unbind(token);

  // Update token's actor sheet (if any)
  token.actor?.sheet?.render();
});

// Create race on actor
Hooks.on("preCreateOwnedItem", (actor, item, options, userId) => {
  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;
  if (actor.race == null) return;

  if (item.type === "race") {
    actor.race.update(item);
    return false;
  }
});

Hooks.on("createOwnedItem", (actor, itemData, options, userId) => {
  if (!(actor instanceof Actor)) return;
  const item = actor.items.get(itemData._id);
  if (!item) return;

  // Show buff if active
  if (item.type === "buff" && getProperty(itemData, "data.active") === true) {
    // Call hook
    Hooks.callAll("pf1.toggleActorBuff", actor, item.data, true);
  }

  if (userId !== game.user._id) return;

  // Create class
  if (item.type === "class") {
    item._onLevelChange(0, item.data.data.level);
  }
});

Hooks.on("preDeleteOwnedItem", (actor, itemData, options, userId) => {
  const item = actor.items.get(itemData._id);
  if (!item) return;

  // Delete class assocations
  if (item.type === "class") item._onLevelChange(item.data.data.level, 0);
});

Hooks.on("deleteOwnedItem", (actor, itemData, options, userId) => {
  // Call buff removal hook
  if (itemData.type === "buff" && getProperty(itemData, "data.active") === true) {
    Hooks.callAll("pf1.toggleActorBuff", actor, itemData, false);
  }

  if (userId !== game.user._id) return;
  if (!(actor instanceof Actor)) return;

  // Remove links
  const itemLinks = getProperty(itemData, "data.links");
  if (itemLinks) {
    for (let [linkType, links] of Object.entries(itemLinks)) {
      for (let link of links) {
        const item = actor.items.find((o) => o._id === link.id);
        let otherItemLinks = item?.links || {};
        if (otherItemLinks[linkType]) {
          delete otherItemLinks[linkType];
        }
      }
    }
  }

  (async () => {
    // Remove token effects for deleted buff
    const isLinkedToken = getProperty(actor.data, "token.actorLink");
    if (isLinkedToken) {
      let promises = [];
      if (itemData.type === "buff" && itemData.data.active) {
        actor.effects.find((e) => e.data.origin?.indexOf(itemData._id) > 0)?.delete();
        const tokens = actor.getActiveTokens();
        for (const token of tokens) {
          promises.push(token.toggleEffect(itemData.img, { active: false }));
        }
      }
      await Promise.all(promises);
    }
  })();
});

Hooks.on("chatMessage", (log, message, chatData) => {
  const result = customRolls(message, chatData.speaker);
  return !result;
});

Hooks.on("renderActorDirectory", (app, html, data) => {
  html.find("li.actor").each((i, li) => {
    li.addEventListener("drop", CurrencyTransfer._directoryDrop.bind(undefined, li.getAttribute("data-entity-id")));
  });
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  html.find("li.item").each((i, li) => {
    li.addEventListener("drop", CurrencyTransfer._directoryDrop.bind(undefined, li.getAttribute("data-entity-id")));
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

// Create macro from item
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type !== "Item") return true;
  macros.createItemMacro(data.data, slot);
  return false;
});

// Create macro from skill
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (data.type !== "skill") return true;
  macros.createSkillMacro(data.skill, data.actor, slot);
  return false;
});

// Create macro to roll miscellaneous attribute from an actor
Hooks.on("hotbarDrop", (bar, data, slot) => {
  if (!["defenses", "cmb", "concentration", "cl", "bab"].includes(data.type)) return true;
  macros.createMiscActorMacro(data.type, data.actor, slot, data.altType);
  return false;
});

// Render TokenConfig
Hooks.on("renderTokenConfig", async (app, html) => {
  // Add vision inputs
  let newHTML = await renderTemplate("systems/pf1/templates/internal/token-config_vision.hbs", {
    object: duplicate(app.object.data),
  });
  html.find('.tab[data-tab="vision"] > *:nth-child(2)').after(newHTML);

  // Add static size checkbox
  newHTML = `<div class="form-group"><label>${game.i18n.localize(
    "PF1.StaticSize"
  )}</label><input type="checkbox" name="flags.pf1.staticSize" data-dtype="Boolean"`;
  if (getProperty(app.object.data, "flags.pf1.staticSize")) newHTML += " checked";
  newHTML += "/></div>";
  html.find('.tab[data-tab="image"] > *:nth-child(3)').after(newHTML);

  // Add disable low-light vision checkbox
  addLowLightVisionToTokenConfig(app, html);
});

// Render Sidebar
Hooks.on("renderSidebarTab", (app, html) => {
  if (app instanceof Settings) {
    // Add changelog button
    let button = $(`<button>${game.i18n.localize("PF1.Changelog")}</button>`);
    html.find("#game-details").append(button);
    button.click(() => {
      new ChangeLogWindow().render(true);
    });

    // Add help button
    button = $(`<button>${game.i18n.localize("PF1.Help.Label")}</button>`);
    html.find("#game-details").append(button);
    button.click(() => {
      new PF1_HelpBrowser().openURL("systems/pf1/help/index.hbs");
    });
  }
});

// Add compendium sidebar context options
Hooks.on("getCompendiumDirectoryPFEntryContext", (html, entryOptions) => {
  // Add option to disable pack
  entryOptions.push({
    name: game.i18n.localize("PF1.Disable"),
    icon: '<i class="fas fa-low-vision"></i>',
    callback: (li) => {
      const pack = game.packs.get(li.data("pack"));
      const config = game.settings.get("core", Compendium.CONFIG_SETTING)[pack.collection];
      const disabled = getProperty(config, "pf1.disabled") === true;
      pack.configure({ "pf1.disabled": !disabled });
    },
  });
});

// Handle chat tooltips
const handleChatTooltips = function (event) {
  const elem = $(event.currentTarget);
  const rect = event.currentTarget.getBoundingClientRect();
  // const x = event.pageX;
  // const y = event.pageY;
  const x = rect.x;
  const y = rect.y;
  const w = rect.width;
  elem.find(".tooltipcontent").css("left", `${x}px`).css("top", `${y}px`).css("width", `${w}px`);
};

// These exports are deprecated.
// Do not use them, access classes and functions from the game.pf1 global instead!
export {
  ActorPF,
  ItemPF,
  ActorSheetPF,
  ActorSheetPFCharacter,
  ActorSheetPFNPC,
  ActorSheetPFNPCLite,
  ActorSheetPFNPCLoot,
  ItemSheetPF,
  ItemSheetPF_Container,
  ActiveEffectPF,
};
export { DicePF, ChatMessagePF, measureDistances };
export { PF1 };
export { getChangeFlat, getSourceInfo } from "./module/actor/apply-changes.js";
export { ItemChange } from "./module/item/components/change.js";
export { SemanticVersion };
export { RollPF } from "./module/roll.js";
export { ChatAttack } from "./module/misc/chat-attack.js";
export { dialogGetNumber, dialogGetActor } from "./module/dialog.js";

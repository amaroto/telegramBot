const FOOD_TABLE = [
  { names: ["huevo", "huevos"], caloriesPerUnit: 78, unitLabel: "pieza", type: "unit" },
  { names: ["manzana", "manzanas"], caloriesPerUnit: 95, unitLabel: "pieza", type: "unit" },
  { names: ["plátano", "platano", "banano", "banana"], caloriesPerUnit: 105, unitLabel: "pieza", type: "unit" },
  { names: ["naranja", "naranjas"], caloriesPerUnit: 62, unitLabel: "pieza", type: "unit" },
  { names: ["pera", "peras"], caloriesPerUnit: 100, unitLabel: "pieza", type: "unit" },
  { names: ["pan", "rebanada de pan", "tostada"], caloriesPerUnit: 80, unitLabel: "rebanada", type: "unit" },
  { names: ["pan integral"], caloriesPerUnit: 70, unitLabel: "rebanada", type: "unit" },
  { names: ["arroz", "arroz cocido"], caloriesPerUnit: 130, unitLabel: "100g", type: "gram" },
  { names: ["arroz blanco"], caloriesPerUnit: 130, unitLabel: "100g", type: "gram" },
  { names: ["arroz integral"], caloriesPerUnit: 111, unitLabel: "100g", type: "gram" },
  { names: ["pollo", "pechuga de pollo", "pollo asado"], caloriesPerUnit: 165, unitLabel: "100g", type: "gram" },
  { names: ["pollo frito"], caloriesPerUnit: 246, unitLabel: "100g", type: "gram" },
  { names: ["carne", "carne de res", "res", "carne de vaca"], caloriesPerUnit: 250, unitLabel: "100g", type: "gram" },
  { names: ["pavo"], caloriesPerUnit: 135, unitLabel: "100g", type: "gram" },
  { names: ["cerdo"], caloriesPerUnit: 297, unitLabel: "100g", type: "gram" },
  { names: ["pescado", "salmón", "salmón", "atún"], caloriesPerUnit: 206, unitLabel: "100g", type: "gram" },
  { names: ["pasta", "espagueti", "fideos"], caloriesPerUnit: 150, unitLabel: "100g", type: "gram" },
  { names: ["tomate", "tomates"], caloriesPerUnit: 18, unitLabel: "100g", type: "gram" },
  { names: ["lechuga"], caloriesPerUnit: 15, unitLabel: "100g", type: "gram" },
  { names: ["papas", "patata", "papa"], caloriesPerUnit: 77, unitLabel: "100g", type: "gram" },
  { names: ["zanahoria", "zanahorias"], caloriesPerUnit: 41, unitLabel: "100g", type: "gram" },
  { names: ["queso"], caloriesPerUnit: 110, unitLabel: "30g", type: "gram" },
  { names: ["yogur", "yogurt"], caloriesPerUnit: 60, unitLabel: "100g", type: "gram" },
  { names: ["leche"], caloriesPerUnit: 60, unitLabel: "100ml", type: "gram" },
  { names: ["café", "cafe"], caloriesPerUnit: 2, unitLabel: "taza", type: "unit" },
  { names: ["jugo", "zumo"], caloriesPerUnit: 45, unitLabel: "100ml", type: "gram" },
  { names: ["aceite"], caloriesPerUnit: 900, unitLabel: "100g", type: "gram" },
  { names: ["azúcar", "azucar"], caloriesPerUnit: 387, unitLabel: "100g", type: "gram" },
  { names: ["mantequilla"], caloriesPerUnit: 717, unitLabel: "100g", type: "gram" },
  { names: ["aguacate", "palta"], caloriesPerUnit: 160, unitLabel: "100g", type: "gram" },
  { names: ["frijoles", "judías", "porotos"], caloriesPerUnit: 127, unitLabel: "100g", type: "gram" },
  { names: ["lentejas"], caloriesPerUnit: 116, unitLabel: "100g", type: "gram" },
  { names: ["cereal"], caloriesPerUnit: 370, unitLabel: "100g", type: "gram" },
  { names: ["galleta", "galletas"], caloriesPerUnit: 50, unitLabel: "pieza", type: "unit" },
  { names: ["pizza"], caloriesPerUnit: 266, unitLabel: "100g", type: "gram" },
  { names: ["taco", "tacos"], caloriesPerUnit: 150, unitLabel: "taco", type: "unit" },
  { names: ["hamburguesa", "burger"], caloriesPerUnit: 250, unitLabel: "unidad", type: "unit" },
  { names: ["helado"], caloriesPerUnit: 207, unitLabel: "100g", type: "gram" },
  { names: ["ensalada"], caloriesPerUnit: 50, unitLabel: "porción", type: "unit" },
];

function normalizeFoodName(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,;]/g, "")
    .replace(/\s+/g, " ");
}

function findFoodItem(foodName) {
  const normalized = normalizeFoodName(foodName);
  return FOOD_TABLE.find((item) =>
    item.names.some((name) => normalized === name || normalized.includes(name)),
  );
}

function estimateFoodCalories(foodName, quantity = 1) {
  const normalizedText = normalizeFoodName(foodName);
  const item = findFoodItem(normalizedText);
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  if (item) {
    let calories = 0;
    if (item.type === "gram") {
      calories = (item.caloriesPerUnit * qty) / 100;
    } else {
      calories = item.caloriesPerUnit * qty;
    }
    return {
      name: normalizedText,
      unit: item.unitLabel,
      matchedName: item.names[0],
      calories: Math.round(calories),
      estimated: true,
    };
  }

  const fallbackCalories = qty > 20 ? Math.round(qty * 1.5) : Math.round(qty * 80);
  return {
    name: normalizedText,
    unit: "unidad",
    matchedName: normalizedText,
    calories: fallbackCalories,
    estimated: false,
  };
}

function getFoodCatalog(limit = 40) {
  const uniqueNames = [];
  for (const item of FOOD_TABLE) {
    const name = item.names[0];
    if (!uniqueNames.includes(name)) {
      uniqueNames.push(name);
    }
    if (uniqueNames.length >= limit) break;
  }
  return uniqueNames;
}

function formatFoodLookup(foodName, quantity = 1) {
  const estimate = estimateFoodCalories(foodName, quantity);
  const estimatedNotice = estimate.estimated ? "" : " (estimado)";

  return `*${quantity} ${estimate.unit}* de *${estimate.name}* ≈ *${estimate.calories} kcal*${estimatedNotice}`;
}

function getDailyCalorieTarget(weightKg, heightCm, ageYears = 30) {
  const age = ageYears > 0 ? ageYears : 30;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const target = Math.round(bmr * 1.375);
  return {
    bmr: Math.round(bmr),
    target,
    activityLevel: "ligera",
  };
}

function formatDayKey(date = new Date()) {
  const utc = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return utc.toISOString().slice(0, 10);
}

function formatCalories(value) {
  return `${Math.round(value)} kcal`;
}

function formatWeightHistory(entries) {
  if (!entries || entries.length === 0) {
    return "No hay registros de peso aún.";
  }

  return entries
    .map((entry) => {
      const date = entry.date;
      const weight = Number(entry.weight_kg).toFixed(1);
      return `• ${date}: ${weight} kg`;
    })
    .join("\n");
}

module.exports = {
  estimateFoodCalories,
  getFoodCatalog,
  formatFoodLookup,
  getDailyCalorieTarget,
  formatDayKey,
  formatCalories,
  formatWeightHistory,
};

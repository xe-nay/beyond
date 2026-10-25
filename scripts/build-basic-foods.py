# Builds src/data/basic-foods.json: everyday foods without a barcode (eggs, rice, chicken...) with
# nutrition per 100 g from USDA FoodData Central SR Legacy (public domain).
# Usage: python scripts/build-basic-foods.py <folder of the extracted SR Legacy CSV download>
import csv, json, re, sys

B = sys.argv[1].rstrip('/\\') + '/'
foods = {r['fdc_id']: r['description'] for r in csv.DictReader(open(B + 'food.csv', encoding='utf-8'))}

# (name shown in the app, SR Legacy description pattern, default serving in g, serving label)
WANT = [
    ('Egg, whole', r'^Egg, whole, raw, fresh$', 50, '1 large egg'),
    ('Egg, boiled', r'^Egg, whole, cooked, hard-boiled$', 50, '1 large egg'),
    ('Egg white', r'^Egg, white, raw, fresh$', 33, '1 egg white'),
    ('Egg yolk', r'^Egg, yolk, raw, fresh$', 17, '1 yolk'),
    ('Chicken breast, cooked', r'^Chicken, broilers or fryers, breast, meat only, cooked, roasted$', 120, None),
    ('Chicken breast, raw', r'^Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw$', 150, None),
    ('Chicken thigh, cooked', r'^Chicken, broilers or fryers, thigh, meat only, cooked, roasted$', 100, None),
    ('Turkey breast, cooked', r'^Turkey, (all classes|whole), breast, meat only, cooked, roasted$', 120, None),
    ('Beef mince 90% lean, cooked', r'^Beef, ground, 90% lean meat / 10% fat, patty, cooked, broiled$', 100, None),
    ('Beef mince 80% lean, cooked', r'^Beef, ground, 80% lean meat / 20% fat, patty, cooked, broiled$', 100, None),
    ('Beef steak, sirloin, cooked', r'^Beef, top sirloin, steak, separable lean only, trimmed to 1/8" fat, all grades, cooked, broiled$', 150, None),
    ('Salmon, cooked', r'^Fish, salmon, Atlantic, farmed, cooked, dry heat$', 120, None),
    ('Tuna, canned in water', r'^Fish, tuna, light, canned in water, drained solids \(', 100, None),
    ('Tuna, canned in oil', r'^Fish, tuna, light, canned in oil, drained solids$', 100, None),
    ('Sardines, canned in oil', r'^Fish, sardine, Atlantic, canned in oil, drained solids with bone$', 100, None),
    ('Cod, cooked', r'^Fish, cod, Atlantic, cooked, dry heat$', 120, None),
    ('Shrimp, cooked', r'^Crustaceans, shrimp, (mixed species, )?cooked(, moist heat)?$', 100, None),
    ('White rice, cooked', r'^Rice, white, long-grain, regular, enriched, cooked$', 150, None),
    ('Brown rice, cooked', r'^Rice, brown, long-grain, cooked \(', 150, None),
    ('White rice, dry', r'^Rice, white, long-grain, regular, raw, enriched$', 75, None),
    ('Pasta, cooked', r'^Pasta, cooked, enriched, without added salt$', 140, None),
    ('Pasta, dry', r'^Pasta, dry, enriched$', 80, None),
    ('Oats, rolled', r'^Cereals, oats, regular and quick, not fortified, dry$', 40, None),
    ('Couscous, cooked', r'^Couscous, cooked$', 150, None),
    ('Quinoa, cooked', r'^Quinoa, cooked$', 150, None),
    ('Bulgur, cooked', r'^Bulgur, cooked$', 150, None),
    ('Bread, white', r'^Bread, white, commercially prepared \(includes soft bread crumbs\)$', 30, '1 slice'),
    ('Bread, whole wheat', r'^Bread, whole-wheat, commercially prepared$', 30, '1 slice'),
    ('Pita bread', r'^Bread, pita, white, enriched$', 60, '1 pita'),
    ('Potato, boiled', r'^Potatoes, boiled, cooked without skin, flesh, without salt$', 150, None),
    ('Sweet potato, baked', r'^Sweet potato, cooked, baked in skin, flesh, without salt$', 150, None),
    ('Lentils, cooked', r'^Lentils, mature seeds, cooked, boiled, without salt$', 150, None),
    ('Chickpeas, cooked', r'^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt$', 150, None),
    ('Kidney beans, cooked', r'^Beans, kidney, all types, mature seeds, cooked, boiled, without salt$', 150, None),
    ('Black beans, cooked', r'^Beans, black, mature seeds, cooked, boiled, without salt$', 150, None),
    ('Hummus', r'^Hummus, commercial$', 30, None),
    ('Tofu, firm', r'^Tofu, raw, firm, prepared with calcium sulfate$', 100, None),
    ('Milk, whole', r'^Milk, whole, 3.25% milkfat, with added vitamin D$', 250, '1 glass'),
    ('Milk, semi-skimmed', r'^Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D$', 250, '1 glass'),
    ('Milk, skimmed', r'^Milk, nonfat, fluid, with added vitamin A and vitamin D \(fat free or skim\)$', 250, '1 glass'),
    ('Greek yogurt, nonfat', r'^Yogurt, Greek, plain, nonfat \(', 170, '1 pot'),
    ('Greek yogurt, whole', r'^Yogurt, Greek, plain, whole milk$', 170, '1 pot'),
    ('Yogurt, plain', r'^Yogurt, plain, whole milk$', 125, '1 pot'),
    ('Cottage cheese', r'^Cheese, cottage, lowfat, 2% milkfat$', 110, None),
    ('Cheddar', r'^Cheese, cheddar, sharp, sliced$', 30, None),
    ('Mozzarella', r'^Cheese, mozzarella, whole milk$', 30, None),
    ('Feta', r'^Cheese, feta$', 30, None),
    ('Parmesan', r'^Cheese, parmesan, hard$', 10, None),
    ('Butter', r'^Butter, salted$', 10, None),
    ('Olive oil', r'^Oil, olive, salad or cooking$', 10, '1 tbsp ≈ 13 g'),
    ('Avocado', r'^Avocados, raw, all commercial varieties$', 100, '½ avocado'),
    ('Peanut butter', r'^Peanut butter, smooth style, without salt$', 16, '1 tbsp'),
    ('Almonds', r'^Nuts, almonds$', 30, None),
    ('Walnuts', r'^Nuts, walnuts, english$', 30, None),
    ('Cashews', r'^Nuts, cashew nuts, raw$', 30, None),
    ('Peanuts', r'^Peanuts, all types, raw$', 30, None),
    ('Pistachios', r'^Nuts, pistachio nuts, raw$', 30, None),
    ('Chia seeds', r'^Seeds, chia seeds, dried$', 15, None),
    ('Dates', r'^Dates, medjool$', 24, '1 date'),
    ('Raisins', r'^Raisins, dark, seedless \(', 30, None),
    ('Banana', r'^Bananas, raw$', 118, '1 medium'),
    ('Apple', r'^Apples, raw, with skin \(', 182, '1 medium'),
    ('Orange', r'^Oranges, raw, all commercial varieties$', 131, '1 medium'),
    ('Strawberries', r'^Strawberries, raw$', 150, None),
    ('Blueberries', r'^Blueberries, raw$', 100, None),
    ('Grapes', r'^Grapes, red or green \(European type, such as Thompson seedless\), raw$', 100, None),
    ('Watermelon', r'^Watermelon, raw$', 280, None),
    ('Mango', r'^Mangos, raw$', 165, None),
    ('Pineapple', r'^Pineapple, raw, all varieties$', 165, None),
    ('Pear', r'^Pears, raw$', 178, '1 medium'),
    ('Kiwi', r'^Kiwifruit, green, raw$', 75, '1 kiwi'),
    ('Tomato', r'^Tomatoes, red, ripe, raw, year round average$', 120, '1 medium'),
    ('Cucumber', r'^Cucumber, with peel, raw$', 100, None),
    ('Lettuce', r'^Lettuce, green leaf, raw$', 50, None),
    ('Spinach', r'^Spinach, raw$', 30, None),
    ('Broccoli', r'^Broccoli, raw$', 100, None),
    ('Carrot', r'^Carrots, raw$', 60, '1 medium'),
    ('Onion', r'^Onions, raw$', 110, '1 medium'),
    ('Red pepper', r'^Peppers, sweet, red, raw$', 120, None),
    ('Zucchini', r'^Squash, summer, zucchini, includes skin, raw$', 120, None),
    ('Mushrooms', r'^Mushrooms, white, raw$', 70, None),
    ('Green beans', r'^Beans, snap, green, raw$', 100, None),
    ('Sweet corn, canned', r'^Corn, sweet, yellow, canned, whole kernel, drained solids$', 100, None),
    ('Olives', r'^Olives, ripe, canned \(small-extra large\)$', 30, None),
    ('Honey', r'^Honey$', 21, '1 tbsp'),
    ('Sugar', r'^Sugars, granulated$', 4, '1 tsp'),
    ('Dark chocolate 70%', r'^Chocolate, dark, 70-85% cacao solids$', 20, None),
    ('Orange juice', r'^Orange juice, raw \(', 250, '1 glass'),
    ('Coffee, black', r'^Beverages, coffee, brewed, prepared with tap water$', 240, '1 cup'),
    ('Tea', r'^Beverages, tea, black, brewed, prepared with tap water$', 240, '1 cup'),
    ('Popcorn', r'^Snacks, popcorn, air-popped$', 25, None),
    ('Rice cakes', r'^Snacks, rice cakes, brown rice, (plain|buckwheat)$', 9, '1 cake'),
    ('Bacon, cooked', r'^Pork, cured, bacon, cooked, baked$', 16, '2 slices'),
    ('Pork chop, cooked', r'^Pork, fresh, loin, center loin \(chops\), bone-in, separable lean only, cooked, broiled$', 120, None),
    ('Croissant', r'^Croissants, butter$', 57, '1 croissant'),
]

NUTR = {'1008': 'kcal', '1003': 'protein', '1004': 'fat', '1005': 'carbs', '1079': 'fiber', '2000': 'sugar', '1258': 'satFat', '1093': 'sodium'}
# Micronutrients by the app's keys (src/domain/micros.ts), in USDA's own units (mg, ug, g); ids are summed.
MICRO = {
    'sodium': ['1093'], 'potassium': ['1092'], 'calcium': ['1087'], 'magnesium': ['1090'], 'iron': ['1089'], 'zinc': ['1095'],
    'phosphorus': ['1091'], 'selenium': ['1103'], 'vitaminA': ['1106'], 'vitaminC': ['1162'], 'vitaminD': ['1114'],
    'vitaminE': ['1109'], 'vitaminK': ['1185'], 'b1': ['1165'], 'b2': ['1166'], 'b3': ['1167'], 'b6': ['1175'],
    'folate': ['1190'], 'b12': ['1178'], 'cholesterol': ['1253'], 'omega3': ['1404', '1278', '1272'], 'caffeine': ['1057'],
}
MICRO_IDS = {i: k for k, ids in MICRO.items() for i in ids}
picked = {}
for name, rx, serving, label in WANT:
    hit = next((fid for fid, d in foods.items() if re.search(rx, d)), None)
    if not hit:
        print('MISSING', name, file=sys.stderr)
        continue
    picked[hit] = (name, serving, label)

values = {fid: {} for fid in picked}
micros = {fid: {} for fid in picked}
for r in csv.DictReader(open(B + 'food_nutrient.csv', encoding='utf-8')):
    if r['fdc_id'] not in values:
        continue
    if r['nutrient_id'] in NUTR:
        values[r['fdc_id']][NUTR[r['nutrient_id']]] = float(r['amount'])
    if r['nutrient_id'] in MICRO_IDS and float(r['amount']) > 0:
        k = MICRO_IDS[r['nutrient_id']]
        micros[r['fdc_id']][k] = micros[r['fdc_id']].get(k, 0) + float(r['amount'])

out = []
for fid, (name, serving, label) in picked.items():
    v = values[fid]
    if 'kcal' not in v:
        print('NO ENERGY', name, file=sys.stderr)
        continue
    r1 = lambda k: round(v[k], 1) if k in v else None
    out.append({
        'id': f'usda-{fid}', 'name': name, 'source': foods[fid],
        'per100': {'kcal': round(v['kcal']), 'protein': r1('protein') or 0, 'carbs': r1('carbs') or 0, 'fat': r1('fat') or 0,
                   'sugar': r1('sugar'), 'fiber': r1('fiber'), 'satFat': r1('satFat'),
                   'salt': round(v['sodium'] * 2.5 / 1000, 2) if 'sodium' in v else None,
                   'micro': {k: round(x, 3) for k, x in micros[fid].items()}},
        'serving': serving, 'servingLabel': label,
    })
out.sort(key=lambda x: x['name'])
with open('src/data/basic-foods.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)
print(len(out), 'foods written')
for x in out:
    p = x['per100']
    print(f"{x['name'][:28]:28} {p['kcal']:4} P{p['protein']:5} C{p['carbs']:5} F{p['fat']:5}")

import Config from '../models/Config.js';

await Config.findOneAndUpdate(
  { singleton: 'main' },
  {
    $set: {
      'baseFees.fragile':    1000,
      'baseFees.groceries':  600,
      'baseFees.large_items':1500,
      'fees.economyMultiplier': 0.7,
    },
  }
);
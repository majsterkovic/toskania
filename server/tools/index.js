import { dayNumToIsoDate, isoDateToDayNum } from './dates.js';
import { listDaysTool } from './listDays.js';
import { getDayTool } from './getDay.js';
import { searchPlanTool } from './searchPlan.js';
import { searchFoodTool } from './searchFood.js';
import { routeTool } from './route.js';
import { openingHoursTool } from './openingHours.js';
import { costsTool, todoTool, packingTool } from './costsAndLists.js';

export function buildToolRegistry({ trip, distanceMatrix }) {
  const dateHelpers = { dayNumToIsoDate, isoDateToDayNum };
  return {
    listDays: listDaysTool(trip, dateHelpers),
    getDay: getDayTool(trip, dateHelpers),
    searchPlan: searchPlanTool(trip),
    searchFood: searchFoodTool(trip),
    route: routeTool(distanceMatrix),
    openingHours: openingHoursTool(trip, dateHelpers),
    costs: costsTool(trip),
    todo: todoTool(trip),
    packing: packingTool(trip),
  };
}

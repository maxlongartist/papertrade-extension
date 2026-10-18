// Preserve execution evidence, omit account and browser routing identifiers.
export function exportExecutionHistory(orders) {
  return JSON.parse(JSON.stringify(orders, (key,value)=>
    ['owner','targetTabId','targetTabKey'].includes(key) ? undefined : value));
}

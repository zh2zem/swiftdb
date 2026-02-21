const pending = new Set<string>();
let scheduled = false;

function flush(): void {
  for (const resource of pending) {
    ScheduleResourceTick(resource);
  }
  pending.clear();
  scheduled = false;
}

export function scheduleTick(resource: string): void {
  pending.add(resource);
  if (!scheduled) {
    scheduled = true;
    setImmediate(flush);
  }
}

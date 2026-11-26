import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap } from 'rxjs';

// A mobil + menü ?new=1-gyel nyitja meg az oldalt, ilyenkor rögtön az "új" ablak jön fel.
// A paramétert kivesszük az URL-ből, hogy frissítéskor ne nyíljon meg újra.
export function newEntryRequests(route: ActivatedRoute, router: Router) {
  return route.queryParamMap.pipe(
    filter(params => params.get('new') === '1'),
    tap(() => void router.navigate([], { relativeTo: route, queryParams: {}, replaceUrl: true }))
  );
}

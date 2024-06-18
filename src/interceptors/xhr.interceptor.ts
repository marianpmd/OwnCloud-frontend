import {Injectable} from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpHeaders,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import {Observable, of, throwError} from 'rxjs';
import {Router} from "@angular/router";

@Injectable()
export class XhrInterceptor implements HttpInterceptor {

  constructor(private router: Router) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let jwt = window.localStorage.getItem("app-jwt");

    const xhr = request.clone({
        withCredentials: true,
        setHeaders: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    return next.handle(xhr);

  }

  private handleError(err: HttpErrorResponse): Observable<any> {
    if (err.status === 401 || err.status === 403) {
      this.router.navigateByUrl(`/login`);
      console.log('Auth Error occured')
      return of(err.message);
    }
    return throwError(() => err);
  }
}

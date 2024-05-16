import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {CookieService} from "ngx-cookie-service";
import jwt_decode from "jwt-decode";

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(private cookieService: CookieService,
              private router: Router) {
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    let token = window.localStorage.getItem("app-jwt")

    if (!token) {
      this.router.navigate(['login']);
      return false;
    }

    let decodedToken = jwt_decode(token);
    console.log("DECODED TOKEN", decodedToken);
    // @ts-ignore
    console.log("DECODED TOKEN ROLE", decodedToken.roles);
    // @ts-ignore
    return decodedToken.roles[0] === 'admin';
  }

}

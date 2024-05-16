import {Component, OnInit} from '@angular/core';
import {AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators} from "@angular/forms";
import {AuthService} from "../../service/auth.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Router} from "@angular/router";
import {MatDialogRef} from "@angular/material/dialog";
import {CookieService} from "ngx-cookie-service";
import {delay} from "rxjs";

export function matchValidator(
  matchTo: string,
  reverse?: boolean
): ValidatorFn {
  return (control: AbstractControl):
    ValidationErrors | null => {
    if (control.parent && reverse) {
      const c = (control.parent?.controls as any)[matchTo] as AbstractControl;
      if (c) {
        c.updateValueAndValidity();
      }
      return null;
    }
    return !!control.parent && !!control.parent.value && control.value === (control.parent?.controls as any)[matchTo].value ? null : {matching: true};
  };
}


@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  email: FormControl = new FormControl('', [Validators.email, Validators.required]);
  password: FormControl = new FormControl('', [Validators.required]);
  confirmPassword: FormControl = new FormControl('', [Validators.required, matchValidator("password")]);
  isLoading: boolean = false;

  constructor(private auth: AuthService,
              private snackBar: MatSnackBar,
              private router: Router,
              private dialogRef : MatDialogRef<RegisterComponent>,
              private cookieService:CookieService) {
  }

  formGroup: FormGroup = new FormGroup({
      email: this.email,
      password: this.password,
      confirmPassword: this.confirmPassword
    },
    {});

  ngOnInit(): void {
  }

  onRegister() {
    this.isLoading = true;
    this.auth.onRegister(this.email.value, this.password.value)
      .subscribe({
        next: (response) => {
          console.log(response);
          this.isLoading = false;
          this.loginAfterRegister(response);
          this.dialogRef.close();
        },
        error: err => {
          this.snackBar.open("Register failed!", "Close", {
            duration: 2000,
            panelClass: ['mat-toolbar', 'mat-warn']
          })
          this.isLoading = false;
        }
      });
  }

  private loginAfterRegister(response: { email: string, password: string }) {
    console.log("in login",response)

    this.auth.onLogin(response.email, btoa(response.password))
      .pipe(
        delay(8)
      )
      .subscribe({
        next: result => {
          this.router.navigate(['/dashboard'],{

          });
        }
      });
  }
}

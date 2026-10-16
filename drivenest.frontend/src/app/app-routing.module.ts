import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginPageComponent } from './login-page/login-page.component';
import { RegisterPageComponent } from './register-page/register-page.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SettingsPageComponent } from './settings-page/settings-page.component';
import { authGuard } from './services/auth.guard';
import { GaragePageComponent } from './garage-page/garage-page.component';

import { FillUpComponentComponent } from './fill-up-component/fill-up-component.component';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'garage/:id', component: GaragePageComponent, canActivate: [authGuard] },
  { path: 'garage', component: GaragePageComponent, canActivate: [authGuard] },
  { path: 'refuelings', component: FillUpComponentComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { anchorScrolling: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

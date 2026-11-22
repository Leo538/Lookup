import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { AppComponent, PREPARE_APE4, UPDATE_APE4_PRESENTATION } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
registerLocaleData(localeEs);
bootstrapApplication(AppComponent,{providers:[
 provideZonelessChangeDetection(),
 {provide:PREPARE_APE4,useValue:true},
 {provide:UPDATE_APE4_PRESENTATION,useValue:{
  previousCaseCode:'LOOKUP-LIQ-2026-001',
  workerFingerprint:'d13721292c8c111655057373b6a153a7898bdd800d159486dc6bd6142f023adf',
 }},
 provideServiceWorker('ngsw-worker.js',{enabled:!isDevMode(),registrationStrategy:'registerWhenStable:30000'}),
]}).catch(console.error);

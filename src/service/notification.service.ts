import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../environments/environment";
import {BehaviorSubject} from "rxjs";
import {NotificationInfo} from "../datamodel/NotificationInfo";

const NOTIFY_ADMIN = environment.baseUrlNotification + '/notification/admin';
const ALL_NOTIFICATIONS = environment.baseUrlNotification + '/notification/all';
const UPDATE_NOTIFICATIONS = environment.baseUrlNotification + '/notification/all/update';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  notifications:NotificationInfo[] = [];
  notificationsSubject!:BehaviorSubject<NotificationInfo[]>;

  constructor(private http:HttpClient) {
    this.notificationsSubject = new BehaviorSubject<NotificationInfo[]>(this.notifications);
  }

  appendToNotifications(notificationInfo:NotificationInfo){
    this.notifications = [notificationInfo,...this.notifications];
    this.notificationsSubject.next(this.notifications);
  }

  setNotifications(userNotifications:NotificationInfo[]){
    this.notifications = userNotifications;
    this.notificationsSubject.next(this.notifications);
  }

  getNotifications(){
    return this.notificationsSubject.asObservable();
  }

  getUserNotifications(){
    return this.http.get<NotificationInfo[]>(ALL_NOTIFICATIONS);
  }

  notifyAdmin(requestInfo:{preferredAmount:string,description:string}){
    return this.http.post(NOTIFY_ADMIN,requestInfo,{
      responseType:"text",
      observe:"response"
    });
  }

  updateNotificationsState() {
    return this.http.get(UPDATE_NOTIFICATIONS,{
      observe:"response"
    });
  }
}

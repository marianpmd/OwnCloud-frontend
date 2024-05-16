import { Injectable } from '@angular/core';
import {environment} from "../environments/environment";
import {HttpClient} from "@angular/common/http";
import {DirectoryInfo} from "../datamodel/DirectoryInfo";
import {DirectoryWithParentInfo} from "../datamodel/DirectoryWithParentInfo";

const CREATE_DIRECTORY = environment.baseUrlStorage + '/dir/create';
const DELETE_DIRECTORY = environment.baseUrlStorage + '/dir/delete';
const ALL_DIRECTORIES = environment.baseUrlStorage + '/dir/getAll/inPath';

@Injectable({
  providedIn: 'root'
})
export class DirectoryService {

  constructor(private http: HttpClient) { }

  createDirectory(dirName:string,pathsFromRoot:string[]){
    let fullPath = [...pathsFromRoot , dirName];
    return this.http.post<DirectoryInfo>(CREATE_DIRECTORY, fullPath);
  }

  getAllDirectories(pathsFromRoot:string[]){
    let actualUrl = ALL_DIRECTORIES;
    if (pathsFromRoot){
      actualUrl = `${actualUrl}/${pathsFromRoot}`
    }
    return this.http.get<DirectoryWithParentInfo>(actualUrl);
  }

  deleteDirectory(id: number) {
    return this.http.delete<DirectoryInfo>(DELETE_DIRECTORY,{
      params:{
        id:id
      }
    })
  }
}

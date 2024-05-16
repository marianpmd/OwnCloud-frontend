import {Injectable} from '@angular/core';
import {HttpClient, HttpEventType, HttpHeaders, HttpParams, HttpResponse} from "@angular/common/http";
import {environment} from "../environments/environment";
import {Observable, tap} from "rxjs";
import {FileInfo, FileInfoPaged} from "../datamodel/FileInfo";
import {SystemInfo} from "../datamodel/SystemInfo";

const UPLOAD_URL = environment.baseUrlStorage + '/file/upload';
const LOAD_ALL_URL = environment.baseUrlStorage + '/file/all';
export const DOWNLOAD_ONE_URL = environment.baseUrlStorage + '/file/one';
export const VIDEO_STREAM_URL = environment.baseUrlStorage + '/file/one/video';
const DELETE_ONE_URL = environment.baseUrlStorage + '/file/delete/one';
const CHECK_FILE_URL = environment.baseUrlStorage + '/file/check';
const LOAD_BY_KEYWORD = environment.baseUrlStorage + '/file/byKeyword';
const GET_SYS_INFO = environment.baseUrlStorage + '/system/info';
const MAKE_PUBLIC = environment.baseUrlStorage + '/file/makePublic';
const MAKE_PRIVATE = environment.baseUrlStorage + '/file/makePrivate';
const GET_THUMBNAIL = environment.baseUrlStorage + '/file/thumbnail';
export const DOWNLOAD_ONE_PUBLIC = environment.baseUrlStorage + '/file/public';

@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(private http: HttpClient) {
  }

  uploadFile(file: File, pathFromRoot: string[], shouldUpdate?: boolean) {
    const formData = new FormData()
    let httpParams = new HttpParams();
    if (pathFromRoot.length === 0)
    httpParams = httpParams.set('pathFromRoot','');

    for (let path of pathFromRoot) {
      httpParams = httpParams.append('pathFromRoot',path);
    }
    const headers = new HttpHeaders({'ngsw-bypass': ''});

    formData.append('file', file);

    if (shouldUpdate) {
      formData.append("shouldUpdate", shouldUpdate as unknown as string);
    }

    return this.http.post(UPLOAD_URL, formData, {
      reportProgress: true,
      responseType: 'json',
      observe: 'events',
      headers: headers,
      params : httpParams
    });
  }

  loadAllFiles(sortBy: string, page: number, size: number, asc: boolean, currentPaths: string[]): Observable<FileInfoPaged> {
    let params = new HttpParams();
    params = params.set("sortBy", sortBy);
    params = params.set("page", page);
    params = params.set("size", size);
    params = params.set("asc", asc);
    if (currentPaths.length === 0) params = params.set("pathFromRoot",'');

    for (let currentPath of currentPaths) {
      params = params.append("pathFromRoot",currentPath);
    }

    return this.http.get<FileInfoPaged>(LOAD_ALL_URL, {params});
  }

  downloadFileById(fileId: number) {
    let headers = new HttpHeaders();
    headers.append("Accept", "*/*");
    return this.http.get(DOWNLOAD_ONE_URL, {
      params: {
        id: fileId
      },
      headers: headers,
      responseType: "blob" as "json",
      reportProgress : true,
      observe: "events",
      withCredentials: true
    })
  }

  static getFileNameFromContentDisposition(contentDispositionVal: string | null): string {
    // @ts-ignore
    let fileNameFull = contentDispositionVal.match(/filename=((["]).*?\2|[^;\n]*)/g)[0];

    fileNameFull = fileNameFull.replace(/"/g, '');

    return fileNameFull.substring(9, fileNameFull.length);
  }

  deleteFileById(fileId: number) {
    return this.http.delete<string>(DELETE_ONE_URL, {
      params: {
        id: fileId
      },
      observe: "response"
    });
  }

  checkFileByName(filename: string, currentPaths: string[]) {

    let httpParams = new HttpParams();
    httpParams = httpParams.append('filename',filename);

    if (currentPaths.length === 0) httpParams = httpParams.set("pathFromRoot",'');

    for (let path of currentPaths) {
      httpParams = httpParams.append('pathFromRoot',path);
    }

    return this.http.get<boolean>(CHECK_FILE_URL, {
      params: httpParams
    });
  }

  getByFileId(id: number) {
    return this.http.get(DOWNLOAD_ONE_URL, {
      responseType: 'arraybuffer' as 'json',
      params: {
        id: id
      }
    })
  }

  findAllByKeyword(value: string) {
    return this.http.get<FileInfo[]>(LOAD_BY_KEYWORD, {
      params: {
        keyword: value
      }
    })
  }

  getSystemInfo(){
    return this.http.get<SystemInfo>(GET_SYS_INFO);
  }

  makeFilePublic(fileId :number) {
    return this.http.put<FileInfo>(MAKE_PUBLIC,{},{
      params : {
        id : fileId
      }
    })
  }

  makeFilePrivate(fileId: number) {
    return this.http.put<FileInfo>(MAKE_PRIVATE,{},{
      params : {
        id : fileId
      }
    })
  }

  getThumbnail(file: FileInfo | undefined) {
    return this.http.get(GET_THUMBNAIL,{
      params : {
        id : file!.id
      },
      responseType: "blob"
    })
  }
}

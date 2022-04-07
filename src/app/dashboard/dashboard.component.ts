import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {SidenavService} from "../../service/sidenav.service";
import {MatSidenav} from "@angular/material/sidenav";
import {ViewportRuler} from "@angular/cdk/overlay";
import {IInfiniteScrollEvent} from "ngx-infinite-scroll";
import {MediaMatcher} from "@angular/cdk/layout";
import {FileSystemFileEntry, NgxFileDropEntry} from "ngx-file-drop";
import {FileService} from "../../service/file.service";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {FileUploadDialogComponent} from "../file-upload-dialog/file-upload-dialog.component";
import {UploadLoadingDialogComponent} from "../upload-loading-dialog/upload-loading-dialog.component";
import {FileInfo} from "../../datamodel/FileInfo";
import {Router} from "@angular/router";
import {JwtHelperService} from "@auth0/angular-jwt";
import {FileType} from "../../utils/FileType";
import {MatSnackBar} from "@angular/material/snack-bar";
import {UploadStateService} from "../../service/upload-state.service";
import {FileItemDialogComponent} from "../file-item-dialog/file-item-dialog.component";
import {HttpStatusCode} from "@angular/common/http";
import {Subscription} from "rxjs";


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  wasTriggered: boolean = false;
  mobileQuery!: MediaQueryList;
  loadingDialogRef!: MatDialogRef<UploadLoadingDialogComponent>;
  loadedFiles: FileInfo[] = [];
  userEmail!: string;
  fileUploadSubscription!: Subscription;
  lastAdded!:FileInfo;

  @ViewChild('snav') snav!: MatSidenav;

  private mobileQueryListener!: () => void;
  private files: File[] = [];

  constructor(private sidenavService: SidenavService,
              private ruler: ViewportRuler,
              private changeDetectorRef: ChangeDetectorRef,
              media: MediaMatcher,
              private fileService: FileService,
              private dialog: MatDialog,
              private router: Router,
              private jwtService: JwtHelperService,
              private snackBar: MatSnackBar,
              private uploadStateService: UploadStateService
  ) {
    this.mobileQuery = media.matchMedia('(max-width : 600px)');
    this.mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addEventListener('', this.mobileQueryListener);
  }

  ngAfterViewInit() {
    this.sidenavService.setSidenav(this.snav);
    if (!this.mobileQuery.matches) {
      this.snav.open();
      this.changeDetectorRef.detectChanges();
    }
  }

  ngOnInit(): void {
    this.fileService.loadAllFiles()
      .subscribe(fileData => {
        this.loadedFiles = fileData;
      })

    let jwt = localStorage.getItem("ocl-jwt");
    let decodedToken = this.jwtService.decodeToken(jwt as string);
    this.userEmail = decodedToken.sub;
  }

  onWindowScroll($event: IInfiniteScrollEvent) {
    console.log("TRIGGER LOAD")
    console.log($event.currentScrollPosition)
  }

  async onFileDrop(files: NgxFileDropEntry[]) {
    let fileArr: File[] = [];
    for (let ngxFile of files) {
      let fileEntry = ngxFile.fileEntry as FileSystemFileEntry;
      let actualFile = await this.getFiles(fileEntry);
      fileArr.push(<File>actualFile);
    }

    this.handleFileUpload(fileArr);
  }


  private getFiles(fileEntry: FileSystemFileEntry) {
    return new Promise(resolve => {
      fileEntry.file(actualFile => {
        resolve(actualFile);
      })
    })
  }

  onUploadClick($event: any) {
    let fileList: FileList = $event.target.files;
    this.handleFileUpload(Array.from(fileList));
  }

  handleFileUpload(files: File[]) {
    if (files.length > 6) {
      this.snackBar.open("Only up to 6 files are allowed at once!", "Close", {
        duration: 2000,
        panelClass: ['mat-toolbar', 'mat-warn']
      });
      return;
    }
    if (this.fileUploadSubscription){
      this.fileUploadSubscription.unsubscribe();
    }
    if (this.loadingDialogRef) {
      this.loadingDialogRef.close();
    }

    let matDialogRef = this.dialog.open(FileUploadDialogComponent, {
      data: files
    });

    matDialogRef.afterClosed()
      .subscribe(result => {
        if (!result) return;
        this.files = files;

        this.loadingDialogRef = this.dialog.open(UploadLoadingDialogComponent, {
          data: files,
          hasBackdrop: false,
          position: {
            right: "true",
            bottom: "true"
          }
        });
        this.fileUploadSubscription = this.uploadStateService.getFileInfo().subscribe(
          result => {
            if (result) {
              if (this.lastAdded !== result){
                this.loadedFiles.push(result);
                this.lastAdded = result;
              }
            }
          }
        );


      });
  }

  onLogoutClick() {
    let jwt = localStorage.getItem("ocl-jwt");
    if (jwt) {
      localStorage.removeItem("ocl-jwt");
      this.router.navigateByUrl("/login");
    }
  }

  getIconBySuffix(fileType: string) {
    switch (fileType) {
      case FileType.FILE :
        return 'insert_drive_file'
      case FileType.IMAGE :
        return 'image'
      case FileType.VIDEO :
        return 'play_circle'
      case FileType.ARCHIVE :
        return 'archive'
      default:
        return 'insert_drive_file'
    }
  }

  onFileItemClick(file: FileInfo) {
    let matDialogRef = this.dialog.open(FileItemDialogComponent, {
      data: file
    });

    matDialogRef.afterClosed()
      .subscribe(result => {
        switch (result) {
          case 'download' :
            this.downloadFileById(file.id);
            break;
          case 'delete' :
            this.deleteFileById(file.id);
            break;
        }
      });
  }

  private downloadFileById(id: number) {
    this.fileService.downloadFileById(id)
      .subscribe(response=>{

      });
  }

  private deleteFileById(id: number) {
    this.fileService.deleteFileById(id)
      .subscribe(response=>{
        if (response.status === HttpStatusCode.Ok){
          this.loadedFiles = this.loadedFiles.filter(fileInfo=>fileInfo.id !== id)
        }
      });
  }
}

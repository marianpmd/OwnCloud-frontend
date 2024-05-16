import {ChangeDetectorRef, Component, ElementRef, HostBinding, OnInit, Renderer2, ViewChild} from '@angular/core';
import {SidenavService} from "../../service/sidenav.service";
import {MatSidenav} from "@angular/material/sidenav";
import {OverlayContainer, ViewportRuler} from "@angular/cdk/overlay";
import {IInfiniteScrollEvent} from "ngx-infinite-scroll";
import {MediaMatcher} from "@angular/cdk/layout";
import {FileSystemFileEntry, NgxFileDropEntry} from "ngx-file-drop";
import {DOWNLOAD_ONE_URL, FileService} from "../../service/file.service";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {FileUploadDialogComponent} from "../dialogs/file-upload-dialog/file-upload-dialog.component";
import {UploadLoadingDialogComponent} from "../dialogs/upload-loading-dialog/upload-loading-dialog.component";
import {FileInfo} from "../../datamodel/FileInfo";
import {ActivatedRoute, Router} from "@angular/router";
import {FileType} from "../../utils/FileType";
import {MatSnackBar} from "@angular/material/snack-bar";
import {UploadStateService} from "../../service/upload-state.service";
import {FileItemDialogComponent} from "../dialogs/file-item-dialog/file-item-dialog.component";
import {HttpStatusCode} from "@angular/common/http";
import {debounceTime, finalize, Observable, retry, Subscription, switchMap, tap} from "rxjs";
import {FileUpdateDialogComponent} from "../dialogs/file-update-dialog/file-update-dialog.component";
import {FiltersDialogComponent} from "../dialogs/filters-dialog/filters-dialog.component";
import {FormControl} from "@angular/forms";
import {DirectoryCreateDialogComponent} from "../dialogs/directory-create-dialog/directory-create-dialog.component";
import {DirectoryService} from "../../service/directory.service";
import {DirectoryInfo} from "../../datamodel/DirectoryInfo";
import {CookieService} from "ngx-cookie-service";
import {DirectoryDeleteDialogComponent} from "../dialogs/directory-delete-dialog/directory-delete-dialog.component";
import * as Stomp from 'stompjs';
import * as SockJS from 'sockjs-client';
import {environment} from "../../environments/environment";
import {AuthService} from "../../service/auth.service";
import {UserInfo} from "../../datamodel/UserInfo";
import {computeFileSize, computeUsagePercentage} from "../../utils/Common";
import jwt_decode from "jwt-decode";
import {StorageRequestDialogComponent} from "../dialogs/storage-request-dialog/storage-request-dialog.component";
import {NotificationService} from "../../service/notification.service";
import {snackSuccessConfig} from "../../utils/UploadState";
import {DirectoryWithParentInfo} from "../../datamodel/DirectoryWithParentInfo";
import {FileChangeService} from "../../service/file-change.service";

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  @ViewChild('snav') snav!: MatSidenav;
  @ViewChild('auto', {static: true}) auto!: ElementRef;

  wasTriggered: boolean = false;
  mobileQuery!: MediaQueryList;
  loadingDialogRef!: MatDialogRef<UploadLoadingDialogComponent>;

  files: FileInfo[] = [];

  parentDir: DirectoryInfo | null | undefined;
  directories: DirectoryInfo[] = [];

  // directoriesObs!: Observable<DirectoryWithParentInfo> ;

  userEmail!: string;
  fileUploadSubscription!: Subscription;

  lastAdded!: FileInfo;
  sortBy: string = 'lastModified';
  asc: boolean = false;

  currentPaths: string[] = []; //root

  currentPage: number = 0;

  value: any;
  isLoading: boolean;
  isRequestMade: boolean = false;
  searchFileControl: FormControl = new FormControl('');
  isLoadingAutocomplete: boolean = false;
  filteredFiles: FileInfo[] = [];
  windowScrolled: boolean = false;

  @HostBinding('class') className = '';

  private readonly mobileQueryListener!: () => void;
  toggleControl: FormControl = new FormControl(false);
  loggedUser!: UserInfo;

  constructor(private sidenavService: SidenavService,
              private ruler: ViewportRuler,
              private changeDetectorRef: ChangeDetectorRef,
              media: MediaMatcher,
              private fileService: FileService,
              private dialog: MatDialog,
              private router: Router,
              private snackBar: MatSnackBar,
              private uploadStateService: UploadStateService,
              private renderer: Renderer2,
              private activeRoute: ActivatedRoute,
              private directoryService: DirectoryService,
              private cookieService: CookieService,
              private overlay: OverlayContainer,
              private authService: AuthService,
              private notificationService: NotificationService,
              private fileChangeService:FileChangeService
  ) {
    this.isLoading = true;
    this.mobileQuery = media.matchMedia('(max-width : 600px)');
    this.mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addEventListener('', this.mobileQueryListener);
  }

  ngOnInit(): void {
    console.log("INIT WAS CALLED");
    let jwt = window.localStorage.getItem("app-jwt");

    let decodedToken = jwt_decode(jwt as string);

    // @ts-ignore
    this.userEmail = decodedToken.sub;

    this.initNotifySocket();

    this.initFileNotifySocket();

    this.initDarkToggle();

    this.initFileChangeService();

    this.loadAllInitialFilesPaginated(this.sortBy, 0, 100, this.asc, this.currentPaths);

    this.directoryService.getAllDirectories(this.currentPaths)
      .pipe(
        tap(data => {
          this.parentDir = data.parent;
          this.directories = data.directories
        })
      ).subscribe();


    this.initUserInfo(this.userEmail);


  }

  ngAfterViewInit() {
    this.searchFileControl.valueChanges
      .pipe(
        debounceTime(500),
        tap(() => {
          this.isLoading = true;
        }),
        switchMap(value => this.findByKeyword(value)
          .pipe(
            finalize(() => {
              this.isLoading = false
            }),
          )
        )
      )
      .subscribe(data => {
        if (data.length == 0) {
          this.files = [];
        } else {
          data.forEach(fdata => {
            if (fdata.fileType === FileType.IMAGE ||
              fdata.fileType === FileType.VIDEO ||
              fdata.fileType === FileType.PDF)
              fdata.isMedia = true;
          })
          this.files = data;
        }

      });


    this.sidenavService.setSidenav(this.snav);
    this.snav.autoFocus = false;
    if (!this.mobileQuery.matches) {
      this.snav.open();
      this.changeDetectorRef.detectChanges();
    }
  }

  private initDarkToggle() {

    if (localStorage.getItem("darkMode") === null) {
      localStorage.setItem('darkMode', "off");
    }

    if (localStorage.getItem("darkMode") === "on") {
      this.toggleControl.setValue(!this.toggleControl.value);
      this.className = 'darkMode';
      this.overlay.getContainerElement().classList.add(this.className);
    } else if (localStorage.getItem("darkMode") === "off") {
      this.className = '';
      this.overlay.getContainerElement().classList.remove('darkMode');
    }
    this.toggleControl.valueChanges.subscribe((darkMode) => {
      const darkClassName = 'darkMode';
      console.log("called")

      this.className = darkMode ? darkClassName : '';
      if (darkMode) {
        localStorage.setItem("darkMode", "on");
        this.overlay.getContainerElement().classList.add(darkClassName);
      } else {
        localStorage.setItem("darkMode", "off");
        this.overlay.getContainerElement().classList.remove(darkClassName);
      }
    });
  }

  private findByKeyword(value: string) {
    return this.fileService.findAllByKeyword(value);
  }

  onWindowScroll($event: IInfiniteScrollEvent) {
    console.log("TRIGGER LOAD")
    console.log("page : ", this.currentPage)

    this.loadFilesAndAppend(this.sortBy, this.currentPage, 100, this.asc, this.currentPaths);
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
    console.log("on click")
    let fileList: FileList = $event.target.files;
    this.handleFileUpload(Array.from(fileList));
  }

  handleFileUpload(files: File[]) {
    // if (files.length > 20) {
    //   this.snackBar.open("Only up to 6 files are allowed at once!", "Close", {
    //     duration: 2000,
    //     panelClass: ['mat-toolbar', 'mat-warn']
    //   });
    //   return;
    // }
    if (this.fileUploadSubscription) {
      this.fileUploadSubscription.unsubscribe();
    }
    if (this.loadingDialogRef) {
      this.loadingDialogRef.close();
    }
    console.log("uplading fil")
    let matDialogRef = this.dialog.open(FileUploadDialogComponent, {
      data: files
    });

    matDialogRef.afterClosed()
      .subscribe(async result => {
        if (!result) return;

        let anyFileExists = await this.checkIfAnyFileExists(files, this.currentPaths);
        if (anyFileExists) {
          console.log("Found a file that exists")
          let fileAlreadyExistsDialogRef = this.dialog.open(FileUpdateDialogComponent);
          fileAlreadyExistsDialogRef.afterClosed()
            .subscribe(result => {
              if (!result) return;
              this.startActualUpload(files, true);
            })
        } else {
          this.startActualUpload(files, false);
        }
      });
  }

  private startActualUpload(files: File[], shouldUpload: boolean) {
    this.loadingDialogRef = this.dialog.open(UploadLoadingDialogComponent, {
      data: {files: files, shouldUpdate: shouldUpload, pathFromRoot: this.currentPaths},
      hasBackdrop: false,
      position: {
        right: "true",
        bottom: "true"
      }
    });

    if (!shouldUpload) {
      this.fileUploadSubscription = this.uploadStateService.getFileInfo().subscribe(
        result => {
          if (result) {
            if (this.lastAdded !== result) {
              // this.files.unshift(result);
              this.lastAdded = result;
            }
          }
        }
      );

      this.initUserInfo(this.userEmail);
    }
  }

  private async checkIfAnyFileExists(files: File[], currentPaths: string[]) {
    for (const file of files) {
      console.log("Checking file : ", file)
      let res = await this.checkOneFile(file, currentPaths);
      if (res === true) {
        return true;
      }
    }
    return false;
  }


  private async checkOneFile(file: File, currentPaths: string[]) {
    return new Promise((resolve => {
      this.fileService.checkFileByName(file.name, currentPaths)
        .subscribe(exists => {
          resolve(exists);
        })
    }))
  }

  onLogoutClick() {
    window.localStorage.removeItem("app-jwt");
    this.router.navigateByUrl("/login");
  }
  //
  // getIconBySuffix(fileType: string) {
  //   switch (fileType) {
  //     case FileType.FILE :
  //       return 'insert_drive_file'
  //     case FileType.IMAGE :
  //       return 'image'
  //     case FileType.VIDEO :
  //       return 'play_circle'
  //     case FileType.ARCHIVE :
  //       return 'archive'
  //     case FileType.PDF :
  //       return 'picture_as_pdf'
  //     default:
  //       return 'insert_drive_file'
  //   }
  // }

  onFileItemClick(file: FileInfo) {
    let matDialogRef = this.dialog.open(FileItemDialogComponent, {
      data: file,
      width: '100vw',
      maxWidth: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      hasBackdrop: false,
      panelClass: 'file-item-dialog'
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
    window.open(`${DOWNLOAD_ONE_URL}?id=${id}`, '_self');
  }

  private deleteFileById(id: number) {
    this.fileService.deleteFileById(id)
      .subscribe(response => {
        if (response.status === HttpStatusCode.Ok) {
          this.files = this.files.filter(fileInfo => fileInfo.id !== id)
          this.initUserInfo(this.userEmail);
        }
      });
  }

  uploaderAction(uploader: HTMLInputElement) {
    if (this.loadingDialogRef) {
      this.loadingDialogRef.close();
      uploader.value = '';
    }
    console.log("clicked test")
    uploader.click();
  }

  openFilters() {
    let matDialogRef = this.dialog.open(FiltersDialogComponent, {
      data: {
        sortBy: this.sortBy,
        asc: this.asc
      },
      autoFocus: false
    });

    matDialogRef.afterClosed()
      .subscribe(result => {
        console.log("Chosen result : ", result);
        if (!result) return;
        this.sortBy = result.sortBy;
        this.asc = result.asc;

        this.currentPage = 0; //reset
        this.files = [];

        this.loadAllInitialFilesPaginated(this.sortBy, this.currentPage, 100, this.asc, this.currentPaths)
      })
  }


  private loadAllInitialFilesPaginated(sortBy: string, page: number, size: number, asc: boolean, currentPaths: string[]) {
    this.fileService.loadAllFiles(sortBy, page, size, asc, currentPaths)
      .pipe(
        retry(10)
      )
      .subscribe(fileData => {
        fileData.content.forEach(fdata => {
          if (fdata.fileType === FileType.IMAGE ||
            fdata.fileType === FileType.VIDEO ||
            fdata.fileType === FileType.PDF)
            fdata.isMedia = true;

        })
        this.files = fileData.content;

        if (!fileData.last)
          this.currentPage = fileData.pageable.pageNumber + 1;
        this.isRequestMade = true;
        this.isLoading = false;
      })
  }

  private loadFilesAndAppend(sortBy: string, currentPage: number, size: number, asc: boolean, currentPaths: string[]) {
    this.fileService.loadAllFiles(sortBy, currentPage, size, asc, currentPaths)
      .subscribe(fileData => {
        console.log("calling append")
        if (!fileData.last) {
          console.log("is not last")

          fileData.content.forEach(fdata => {
            if (fdata.fileType === FileType.IMAGE ||
              fdata.fileType === FileType.VIDEO ||
              fdata.fileType === FileType.PDF)
              fdata.isMedia = true;

            this.files.push(fdata);
          })

          this.currentPage = fileData.pageable.pageNumber + 1;
          console.log("pushed files : ", this.files)
        }
      })
  }

  scrollToTop() {
    // @ts-ignore
    return document.getElementsByClassName('infinite-container')[0].scroll({
      behavior: 'smooth',
      top: 0,
      left: 0
    });
  }
  addDirectory() {
    this.dialog.open(DirectoryCreateDialogComponent)
      .afterClosed()
      .subscribe(result => {
        if (!result) {
          this.snackBar.open("Directory must have a name", 'Close', {
            duration: 2000,
            panelClass: ['mat-toolbar', 'mat-warn']
          })
        }

        this.directoryService.createDirectory(result, this.currentPaths)
          .subscribe(response => {
            console.log("THE RESPONSE OF CR DIR : ", response)
            this.directories.push(response);
          })

      });
  }

  loadDirectoriesByPath() {
    this.directoryService.getAllDirectories(this.currentPaths)
      .subscribe(response => {
        console.log("LOCAL PATH : ");
        console.log(this.currentPaths)
        console.log(response)

        this.directories = response.directories
        if (response.parent !== null) {
          this.parentDir = response.parent;
        } else {
          this.parentDir = null;
        }
      })
  }

  onDirClick(dir: DirectoryInfo) {
    this.isLoading = true;
    this.currentPaths.push(dir.name);
    this.loadDirectoriesByPath();
    this.loadAllInitialFilesPaginated(this.sortBy, 0, 100, this.asc, this.currentPaths);

  }

  onParentClick() {
    this.isLoading = true;
    this.currentPaths.pop();
    this.loadDirectoriesByPath();
    this.loadAllInitialFilesPaginated(this.sortBy, 0, 100, this.asc, this.currentPaths);
  }


  updateColor(downloadedAmount: number) {
    if (downloadedAmount > 99) return 'accent';
    return 'primary';
  }

  onDirDeleteClick(dir: DirectoryInfo) {
    let matDialogRef = this.dialog.open(DirectoryDeleteDialogComponent, {
      data: dir
    });

    matDialogRef.afterClosed()
      .subscribe(response => {
        if (response) {
          this.directoryService.deleteDirectory(dir.id)
            .subscribe(deleted => {
              this.directories = this.directories.filter(dir => dir.id !== deleted.id);
              this.initUserInfo(this.userEmail);
            });
        }
      })
  }

  private initNotifySocket() {
    console.log("Initialize WebSocket Connection for notifications");

    let ws = new SockJS(`${environment.baseUrlNotificationWs}/ws`);
    let stompClient = Stomp.over(ws);
    let _this = this;
    stompClient.connect({}, function (frame) {
      stompClient.subscribe(`/user/${_this.loggedUser.email}/queue/notify`, function (sdkEvent) {
        console.log(sdkEvent)
        let parsedBody = JSON.parse(sdkEvent.body);
        _this.notificationService.appendToNotifications(parsedBody);

        _this.initUserInfo(_this.userEmail);

        _this.snackBar.open("You've got a new message!", "x", snackSuccessConfig());
      });
    }, (err) => console.log(err));
  }


  private initFileNotifySocket() {
    console.log("Initialize WebSocket Connection for file updates");

    let ws = new SockJS(`${environment.baseUrlStorage}/ws`);
    let stompClient = Stomp.over(ws);
    let _this = this;
    stompClient.connect({}, function (frame) {
      stompClient.subscribe(`/user/${_this.loggedUser.email}/queue/newFile`, function (sdkEvent) {
        console.log(sdkEvent)
        let parsedBody = JSON.parse(sdkEvent.body) as FileInfo;
        if (parsedBody.fileType === FileType.IMAGE ||
          parsedBody.fileType === FileType.VIDEO ||
          parsedBody.fileType === FileType.PDF)
          parsedBody.isMedia = true;
        console.log("the new file : ");
        console.log(parsedBody);
        console.log("the size")
        console.log(_this.files)
        _this.files.unshift(parsedBody);
        _this.initUserInfo(_this.userEmail);

        _this.snackBar.open("A new file was added!", "x", snackSuccessConfig());
      });
    }, (err) => console.log(`Could not connect to ws :  ${err}`));
  }

  private initUserInfo(userEmail: string) {
    this.authService.getUserInfo(userEmail)
      .subscribe(response => {
        this.loggedUser = response;
      });
  }

  computeSpaceSize(value: number) {
    return computeFileSize(value);
  }

  onAdminClick() {
    this.router.navigate(['/dashboard/admin']);
  }

  isAdminPath() {
    return this.router.url === "/dashboard/admin";
  }

  onUserBoardClick() {
    this.router.navigate(['/dashboard']);
  }

  computeUsagePercentage(loggedUser: UserInfo) {
    return computeUsagePercentage(loggedUser);
  }

  onRequestStorageClick() {
    this.dialog.open(StorageRequestDialogComponent, {
      data: this.loggedUser
    })
  }

  onMonitorClick() {
    window.open(environment.baseUrlStorage+'/monitoring')
  }

  private initFileChangeService() {
    this.fileChangeService.getChangedFileId()
      .subscribe(res=>{
        console.log("FILE WAS DELETED")
        this.files = this.files.filter(fileInfo => fileInfo.id !== res)
        this.initUserInfo(this.userEmail);
      })
  }
}

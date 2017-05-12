'use strict';

/** 代码仓库中路径选择与读取*/
var CONFIG_TYPES = [];
/** 默认选中路径*/
var curSelected = null;

/** 项目ID*/
const PROJECT_ID = 51;
/** 默认GitLab分支*/
const BRANCH = 'master';
/** GitLab登陆认证过期时间(天)*/
const COOKIE_EXPIRE_DAYS = 30;
/**　登陆信息在浏览器存储cookies name*/
const COOKIE_KEY_LOGIN_USER = 'login_user';
/**　上次选择信息在浏览器存储last_choose*/
const COOKIE_KEY_LAST_CHOOSE = 'last_choose';

const DEFAULT_CONFIG_PATH = 'config';

/** 获取gitlab接口数据*/
const URL_GITLAB_BASE = 'http://gitlab.meizu.com';
/** GitLab的Api根地址*/
const URL_GITLAB_BASE_API = `${URL_GITLAB_BASE}/api/v3`;
/** GitLab获取登陆认证的URL*/
const URL_GITLAB_SESSION = `${URL_GITLAB_BASE_API}/session`;
/** GitLab获取用户信息的URL*/
const URL_GITLAB_USER = `${URL_GITLAB_BASE}/u/`;
/**　GitLab上指定项目的Api地址*/
const URL_GITLAB_FILE = `${URL_GITLAB_BASE_API}/projects/${PROJECT_ID}/repository/files`;
/** Gitlab用于列出文件和目录*/
const URL_GITLAB_TREE = `${URL_GITLAB_BASE_API}/projects/${PROJECT_ID}/repository/tree`;
/** Gitlab没有用户头像*/
const URL_NO_AVATAR = `${URL_GITLAB_BASE}/assets/no_avatar-849f9c04a3a0d0cea2424ae97b27447dc64a7dbfae83c036c45b403392f0e8ba.png`;
const FILE_NAME_FLOWS = '/flows.json';
const FILE_NAME_MAIN = '/main.json';

/** 全局用户信息*/
var globalUserInfo = null;

/** 编辑框与label文本之间的切换*/
var editableViews = [];

var addEditable = function (editable) {
    editableViews.push(editable);
};

var closeEditables = function () {
    editableViews.map((editable)=> {
        if (editable && editable.isMounted()) {
            if (editable.closeEditable) {
                editable.closeEditable();
            } else {
                editableViews.remove(editable);
            }
        }
    });
};

var branchInputFunc = null;
$('#branchInputOk').click(()=> {
    let [upstreamCtrl, downstreamCtrl] = [$('#branchInputUpstream'), $('#branchInputDownstream')];
    let [textUp, textDown] = [upstreamCtrl.val().trim(), downstreamCtrl.val().trim()];
    if (textUp !== '' && textDown !== '') {
        $('#branchInputModal').modal('hide');
        if (branchInputFunc !== null) {
            branchInputFunc(textUp, textDown);
        }
        upstreamCtrl.val('');
        downstreamCtrl.val('');
    } else {
        alert('输入不能为空,请重新输入!');
    }
});


/** 批量选择模态对话框的全局绑定
 * 可以批量输入repoName进行批量选择*/
var selectModalFunc = null;
$('#selectModalOk').click(()=> {
    let inputCtrl = $('#selectModalContent');
    let inputText = inputCtrl.val().trim();
    if (inputText !== '') {
        var inputArr = inputText.split("\n");
        selectModalFunc && selectModalFunc(inputArr);
        $('#selectModal').modal('hide');
        inputCtrl.val('');
    } else {
        alert('输入不能为空,请重新输入!');
    }
});

var mailModalFunc = null;
$('#mailAddOk').click(()=> {
    let inputCtrl = $('#mailAddContent');
    let inputText = inputCtrl.val().trim();
    if (inputText !== '') {
        var inputArr = inputText.split("\n");
        mailModalFunc && mailModalFunc(inputArr);
        $('#mailAddModal').modal('hide');
        inputCtrl.val('');
    } else {
        alert('输入不能为空,请重新输入!');
    }
});


/** 批量操作模态对话框的全局绑定*/
var modalType = '';
var addModalFunc = null;
var deleteModalFunc = null;
var modalSelectionChange = null;

/** 批量操作模态对话框提交事件*/
$('#myModalCommit').click(()=> {
    let [upstreamCtrl, downstreamCtrl] = [$('#myModalUpStream'), $('#myModalDownStream')];
    let [textUp, textDown] = [upstreamCtrl.val().trim(), downstreamCtrl.val().trim()];
    if (textUp !== '' && textDown !== '') {
        $('#myModal').modal('hide');
        if (modalType === '添加分支') {
            addModalFunc(textUp, textDown);
        } else {
            deleteModalFunc(textUp, textDown);
        }
        upstreamCtrl.val('');
        downstreamCtrl.val('');
    } else {
        alert('输入不能为空,请重新输入!');
    }
});

/** 批量操作模态对话框选择改编事件*/
$('#myModalSelect').change((event)=> {
    modalSelectionChange(event)
});


/** 从服务器载入最初始的内容*/
var originContentFlows = '';
var originContentMain = '';

/** Gitlab相关变量*/
var gitlabCommitFunc = null;
/** Gitlab提交信息模态框*/
$('#commitModalOk').click((event)=> {
    event.preventDefault();
    let logCtrl = $('#commitModalLog');
    let log = logCtrl.val().trim();
    if (log === '') {
        alert('提交日志不能为空,请重新输入!');
    } else if (gitlabCommitFunc !== null) {
        //log不为空,则提交修改
        gitlabCommitFunc(log);
    }
});

/**
 * 获取远程服务器文件内容操作封装
 * @param fileName　远程文件名
 * @param callback　回调函数
 * @param exception 出错回调
 */
var getRemoteContent = function (fileName, callback, exception) {
    let params = {
        private_token: globalUserInfo.private_token,
        ref: BRANCH,
        file_path: `${DEFAULT_CONFIG_PATH}/${curSelected}${fileName}`
    };
    $.getJSON(URL_GITLAB_FILE, params, (response)=> {
        let content = response.content;
        if (response.encoding && response.encoding === 'base64') {
            content = window.atob(content);
        }
        if (callback) {
            callback(content);
        }
    }, (error)=> {
        alert(`网络出错[${error}]`);
        if (exception) {
            exception(error);
        }
    });
};

/**
 * 获取远程服务器文件列表
 * @param path　路径
 * @param callback　回调函数
 * @param exception 出错回调
 */
var getRemoteTree = function (path, callback, exception) {
    let params = {
        private_token: globalUserInfo.private_token,
        ref_name: BRANCH,
        path: path
    };
    $.getJSON(URL_GITLAB_TREE, params, (response)=> {
        let config_arr = [];
        for (var i in response) {
            let config = response[i];
            if (config.type === 'tree' && config.name !== 'tests' && config.name !== 'template') {
                config_arr.push(config.name);
            }
        }
        if (callback) {
            callback(config_arr);
        }
    }, (error)=> {
        alert(`网络出错[${error}]`);
        if (exception) {
            exception(error);
        }
    });
};

/**
 * Git提交操作
 * @param content 文件内容
 * @param fileName　文件名
 * @param log　提交信息
 * @param callback　成功回调
 * @param exception　失败回调
 */
var commitRemoteFile = function (content, fileName, log, callback, exception) {
    //组建提交参数
    let params = {
        private_token: globalUserInfo.private_token,
        branch_name: BRANCH,
        file_path: `${DEFAULT_CONFIG_PATH}/${curSelected}${fileName}`,
        encoding: 'text',
        content: content,
        commit_message: log
    };
    //Ajax做PUT提交
    $.ajax({
        type: 'PUT',
        url: URL_GITLAB_FILE,
        data: params,
        success: function (data) {
            if (callback) {
                callback(data);
            }
        },
        error: function (msg) {
            let message = JSON.parse(msg.responseText).message;
            exception(message);
        }
    });
};

/**
 * 调用该全局函数可以显示提交对话框并完成代码提交操作
 * @param curContent　修改后的文件内容
 * @param oriContent　上一次从服务器加载的文件内容
 * @param fileName　文件名
 */
var commitJsonFile = function (curContent, oriContent, fileName) {

    //判断是否有修改,没有修改则不需要提交
    if (curContent === oriContent) {
        alert('没有任何修改,无需提交!');
        return
    }
    getRemoteContent(fileName, (content)=> {
        if (content !== oriContent) {
            if (confirm('远程文件已发生改动,是否丢弃修改并载入最新版本?')) {
                location.reload();
            }
            return
        }
        gitlabCommitFunc = (log)=> {
            jsonSaveCommit(curContent, oriContent, fileName, log);
        };
        showCommitModal(curContent, oriContent, fileName);
    });
};

/**
 * 显示提交模态对话框
 * @param curContent　编辑后的内容
 * @param oriContent　编辑前的内容
 * @param fileName　文件名
 */
var showCommitModal = function (curContent, oriContent, fileName) {
    //json与源进行diff计算
    // let diff = JsDiff.diffLines(oriContent, curContent);
    //获取diff显示区域
    // let diffPreview = document.getElementById('diffPreview');
    //清空显示区域
    diffPreview.textContent = curContent;
    //显示diff内容
    // diff.forEach(function (part) {
    //     let color = part.added ? 'GREEN' : part.removed ? 'RED' : '#778899';
    //     let span = document.createElement('span');
    //     span.style.color = color;
    //     if (part.added || part.removed) {
    //         span.style.background = '#87CEFF';
    //     }
    //     span.appendChild(document.createTextNode(part.value));
    //     diffPreview.appendChild(span);
    // });
    //弹出模态对话框
    $('#commitModalFileName').html(`修改的文件: ${DEFAULT_CONFIG_PATH}/${curSelected}${fileName}`);
    $('#commitModal').modal();
};

/**
 * 在输完提交信息后点击提交按钮的时候再拉一次服务器上的最新代码，防止冲突
 * @param curContent
 * @param oriContent
 * @param fileName
 * @param log
 */
var jsonSaveCommit = function (curContent, oriContent, fileName, log) {
    getRemoteContent(fileName, (content)=> {
        if (content !== oriContent) {
            if (confirm('远程文件已发生改动,是否丢弃修改并载入最新版本?')) {
                location.reload();
            }
            return
        }
        commitRemoteFile(curContent, fileName, log, (content)=> {
            //提交成功后隐藏模态框,刷新页面
            alert('提交成功了!');
            let logCtrl = $('#commitModalLog');
            logCtrl.val('');
            $('#commitModal').modal('hide');
            location.reload();
        }, (error)=> {
            alert(`提交网络出错[${error}]`);
        });
    });
};

/**
 * 判断repos 对象种是否存在rempName
 * @param repos
 * @param repoName
 * @returns {boolean}
 */
var existsRepo = function (repos, repoName) {
    return repos[repoName] !== undefined
};

/**
 * 公共方法，判断branch数组中是否含有指定upstream，downstream的流
 * @param branchList
 * @param upstream
 * @param downstream
 * @returns {boolean}
 */
var existsBranch = function (branchList, upstream, downstream) {
    if (branchList instanceof Array && upstream && downstream) {
        for (var key in branchList) {
            if (branchList[key].upstream === upstream
                && branchList[key].downstream === downstream) {
                return true
            }
        }
    }
    return false
};

/**
 * 定义公共操作的MixIn
 */
var EditableMixIn = {
    getInitialState: function () {
        return ({
            editable: false,
        });
    },
    componentDidMount() {
        addEditable(this);
    },
    closeEditable() {
        this.setState({
            editable: false,
        });
    },
    changeEditable(event) {
        event && event.preventDefault() && event.stopPropagation();
        let editable = this.state.editable;
        closeEditables();
        this.setState({
            editable: !editable,
        });
    }
};

/***
 * 最外层View，根据不同登录态显示不同界面
 */
var ContainerView = React.createClass({

    getInitialState: function () {
        return {
            login: false
        };
    },

    componentDidMount() {
        /** 先从本地缓存读取用户信息*/
        this.loadDataFromCookie();
    },

    render: function () {
        if (!this.state.login) {
            return (<LoginView onLogin={this.onLogin}/>)
        } else {
            return (<MainView/>);
        }
    },

    /** 登录成功，需要重新刷新界面*/
    onLogin: function () {
        this.setState({
            login: true
        });
    },

    /** 从cookie中读取本地缓存*/
    loadDataFromCookie: function () {
        let userString = $.cookie(COOKIE_KEY_LOGIN_USER);
        if (!userString || userString.trim() === '') {
            return;
        }
        globalUserInfo = JSON.parse(userString);
        if (globalUserInfo) {
            this.setState({
                login: true
            });
        }
        let lastSel = $.cookie(COOKIE_KEY_LAST_CHOOSE);
        if (lastSel && lastSel !== '') {
            curSelected = lastSel;
        }
    }
});


/** 登录界面
 * 如果用户为登录，则显示此界面
 * */
var LoginView = React.createClass({

    render: function () {
        return (<center>
            <div className="jumbotron form-horizontal"
                 style={{maxWidth: 480, padding: 80}}>
                <h2>用户登录</h2>
                <h4>请使用
                    <a href={URL_GITLAB_BASE}
                       target="view_window">GitLab
                    </a>
                    账号密码登录<br/>账号为工作邮箱前缀
                </h4>
                <div className="form-group input-group">
                    <span className="input-group-addon">
                        <i className="icon-user"/>用户名</span>
                    <input type="text"
                           ref="inputUserName"
                           onKeyDown={this.onUserNameKeyDown}
                           className="form-control"
                           placeholder="输入Gitlab账号"/>
                </div>
                <div className="form-group input-group">
                    <span className="input-group-addon">
                        <i className="icon-key"/>{'密　码'}</span>
                    <input type="password"
                           ref="inputPassword"
                           onKeyDown={this.onPasswordKeyDown}
                           className="form-control"
                           placeholder="输入密码"/>
                </div>
                <div className="form-group">
                    <div className="col-sm-offset-2 col-sm-10">
                        <div className="checkbox">
                            <label>
                                <input type="checkbox" defaultChecked='true'
                                       ref="inputRemember"/>
                                {`记住我${COOKIE_EXPIRE_DAYS}天`}
                            </label>
                        </div>
                    </div>
                </div>
                <div>
                    <button type="submit"
                            className="btn btn-primary"
                            ref="inputLogin"
                            onClick={this.onLoginClick}
                            style={{marginLeft: 60}}>{'登　录'}</button>
                    <button type="submit"
                            onClick={this.onResetClick}
                            className="btn btn-default"
                            style={{marginLeft: 60}}>{'重　置'}</button>
                </div>
            </div>
        </center>);
    },

    /** 回车键跳到下一个输入框*/
    onUserNameKeyDown: function (event) {
        if (event.keyCode == 13 && this.refs.inputUserName.value != '') {
            this.refs.inputPassword.focus();
        }
    },
    /** 回车键登录*/
    onPasswordKeyDown: function (event) {
        if (event.keyCode == 13 && this.refs.inputPassword.value != '') {
            this.refs.inputLogin.focus();
        }
    },

    /** 当登录成功时*/
    onLoginSucceed: function (userInfo) {
        /** 如果需要缓存登录信息，则保存cookies*/
        if (this.refs.inputRemember.checked) {
            $.cookie(COOKIE_KEY_LOGIN_USER, JSON.stringify(userInfo), {expires: COOKIE_EXPIRE_DAYS});
        } else {
            $.cookie(COOKIE_KEY_LOGIN_USER, JSON.stringify(userInfo));
        }
        globalUserInfo = userInfo;
        this.props.onLogin();
    },

    /**
     * 点击登录按钮
     * @param event
     */
    onLoginClick: function (event) {
        let userName = this.refs.inputUserName.value;
        let password = this.refs.inputPassword.value;
        if (userName === '') {
            this.refs.inputUserName.focus();
            return;
        }
        if (password === '') {
            this.refs.inputPassword.focus();
            return;
        }
        let params = {
            login: userName,
            password: password
        };
        //登录请求
        $.post(URL_GITLAB_SESSION, params).success((response)=> {
            this.onLoginSucceed(response);
        }).error((error)=> {
            let errMsg = error.statusText;
            if (error.status === 401) {
                errMsg = '验证失败，用户名或密码错了吧！'
            }
            alert(errMsg);
        });
    },

    /**
     * 点击重置按钮
     * @param event
     */
    onResetClick: function (event) {
        this.refs.inputUserName.value = '';
        this.refs.inputPassword.value = '';
    }

});


/**
 * 定义主页面
 * */
var MainView = React.createClass({

    getInitialState: function () {
        return {
            loadingFlows: true,
            responseFlows: null,
            successFlows: false,
            loadingMain: true,
            responseMain: null,
            successMain: false
        };
    },

    componentDidMount() {
        // this.loadDataFlows();
        // this.loadDataMain();
    },

    render: function () {
        return (<div>
            <TopBarView onFileChange={this.onFileChange}/>
            <div className="row">
                <div className="col-xs-3">
                    <MailView success={this.state.successMain}
                              loading={this.state.loadingMain}
                              response={JSON.parse(this.state.responseMain)}/></div>
                <div className="col-xs-9">
                    <FlowView success={this.state.successFlows}
                              loading={this.state.loadingFlows}
                              response={JSON.parse(this.state.responseFlows)}/></div>
            </div>
        </div>);
    },

    onFileChange: function () {
        this.loadDataFlows();
        this.loadDataMain();
    },

    /** 读取flows.json*/
    loadDataFlows: function () {
        this.setState({
            responseFlows: null,
            loadingFlows: true,
            successFlows: false
        });
        getRemoteContent(FILE_NAME_FLOWS, (content)=> {
            originContentFlows = content;
            this.setState({
                responseFlows: content,
                loadingFlows: false,
                successFlows: true
            });
        }, (error)=> {
            this.setState({
                responseFlows: null,
                loadingFlows: false,
                successFlows: false
            });
        });
    },

    /** 读取main.json*/
    loadDataMain: function () {
        this.setState({
            responseMain: null,
            loadingMain: true,
            successMain: false
        });
        getRemoteContent(FILE_NAME_MAIN, (content)=> {
            originContentMain = content;
            this.setState({
                responseMain: content,
                loadingMain: false,
                successMain: true
            });
        }, (error)=> {
            this.setState({
                responseMain: null,
                loadingMain: false,
                successMain: false
            });
        });
    }

});

/**　顶部导航栏*/
var TopBarView = React.createClass({

    componentDidMount() {
        this.loadConfigTypes();
    },

    /** 读取文件夹列表*/
    loadConfigTypes: function () {
        getRemoteTree(DEFAULT_CONFIG_PATH,
            (content)=> {
                CONFIG_TYPES = content;
                if (!curSelected) {
                    curSelected = content[0];
                }
                this.props.onFileChange();
            }, (error)=> {

            })
    },

    render: function () {
        return (<nav className="navbar navbar-default">
            <div className="navbar-form navbar-left">
                <select name="select"
                        className="form-control"
                        value={curSelected}
                        onChange={this.onSelectionChange}>{
                    CONFIG_TYPES.map((item)=> {
                        return (<option key={item}>{item}</option>);
                    })
                }
                </select>
            </div>
            <div className="navbar-form navbar-right">
                <button className="btn btn-danger navbar-right"
                        onClick={this.onLogoutClick}
                        style={{marginRight: 10}}><i className=" icon-signout"/>登出
                </button>
            </div>
            < a
                className="navbar-text navbar-right"
                href={`${URL_GITLAB_USER}${globalUserInfo.username}`}
                target="view_window"> {globalUserInfo.username
            }</a>
            <div className="navbar-form navbar-right">
                <img style={{width: 32, height: 32}}
                     src={globalUserInfo.avatar_url?globalUserInfo.avatar_url:URL_NO_AVATAR}/>
            </div>
        </nav>);
    },

    onSelectionChange: function (event) {
        curSelected = event.target.value;
        $.cookie(COOKIE_KEY_LAST_CHOOSE, curSelected);
        this.props.onFileChange();
    },

    onLogoutClick: function (event) {
        $.cookie(COOKIE_KEY_LOGIN_USER, null);
        location.reload();
    }

});

/**　自动邮件发送配置*/
var MailView = React.createClass({
    getInitialState: function () {
        return {};
    },

    render: function () {
        if (this.props.loading) {
            return (<span>
                <center><h3>
                    <i className="icon-spinner icon-spin"/>正在读取...</h3></center>
            </span>);
        }
        if (this.props.success) {
            if (this.props.response.MAIL_TO == undefined) {
                this.props.response.MAIL_TO = [];
            }
            if (this.props.response.MAIL_CC == undefined) {
                this.props.response.MAIL_CC = [];
            }
            if (this.props.response.MAIL_BRANCH_AWARE == undefined) {
                this.props.response.MAIL_BRANCH_AWARE = {};
            }
            return (<div>
                    <center>
                        <h3><i className="icon-envelope"/> 发邮件配置</h3>
                        <div style={{maxWidth: 320, minWidth: 300}}>
                            <MailTableView tableName="仅接收代码流报告(MAIL TO)"
                                           tableData={this.props.response.MAIL_TO}/>
                            <MailTableView tableName="接收所有代码流邮件(MAIL CC)"
                                           tableData={this.props.response.MAIL_CC}/>
                            <MailBranchAwareView tableName="接收特定分支的代码流邮件"
                                                 tableData={this.props.response.MAIL_BRANCH_AWARE}/>
                        </div>
                        <button className="btn btn-primary" onClick={this.onCommitClick}>
                            <i className="icon-upload-alt"/>提交修改
                        </button>
                    </center>
                </div>
            );
        } else {
            return (<span>
            <center><h3>Error...</h3></center>
            </span>);
        }
    },

    onCommitClick: function (event) {
        let curContent = JSON.stringify(this.props.response, null, 2);
        commitJsonFile(curContent, originContentMain, FILE_NAME_MAIN);
    }
});

var MailBranchAwareView = React.createClass({
    render: function () {
        let tableObj = this.props.tableData;
        let tableArr = [];
        for (let tab in tableObj) {
            let tabName = tableObj[tab];
            tabName.key = tab;
            tableArr.push(tabName);
        }
        return (<table className="table table-striped table-condensed table-bordered">
            <thead>
            <tr className="info">
                <th >
                    <center>{this.props.tableName}</center>
                </th>
                <th>
                    <center>
                        <button className="btn btn-link"
                                onClick={this.onAddClick}>
                            <i className="icon-plus"/>添加
                        </button>
                    </center>
                </th>
            </tr>
            </thead>
            {tableArr.map((data)=> {
                return (<MailTableCore tableData={data}
                                       key={data.key}
                                       hasDelete={true}
                                       onDelete={this.onDelete}
                                       tableName={data.key}/>)
            })}
        </table>);
    },

    onAddClick: function (event) {
        $('#mailAddModal').modal();
        mailModalFunc = this.onBranchAdd;
    },

    onBranchAdd: function (mailArray) {
        $.each(mailArray, (index, mail)=> {
            let tableObj = this.props.tableData;
            mail = mail.trim();
            if (mail && tableObj[mail] === undefined) {
                tableObj[mail] = [];
            }
        });
        this.setState({});
    },

    onDelete: function (name) {
        var c = confirm('确定要删除[' + name + ']？');
        if (c) {
            delete this.props.tableData[name];
            this.setState({});
        }
    }
});

/** 邮件列表*/
var MailTableView = React.createClass({

    render: function () {
        if (this.props.tableData != null) {
            return (<table className="table table-striped table-condensed table-bordered">
                <MailTableCore tableData={this.props.tableData}
                               tableName={this.props.tableName}/>
            </table>);
        }
    }
});

var MailTableCore = React.createClass({
    render: function () {
        return (<tbody>
        {this.props.hasDelete && <tr className="success">
            <th>
                <center>{this.props.tableName}</center>
            </th>
            <td style={{width:86, textAlign:'center'}}>
                <button className="btn btn-link"
                        onClick={(event)=>{this.props.onDelete(this.props.tableName)}}>
                    <i className="icon-trash"/>删除
                </button>
            </td>
        </tr> || <tr>
            <th colSpan="2" className="info">
                <center>{this.props.tableName}</center>
            </th>
        </tr>}
        {this.props.tableData.map((data, index)=> {
            return (<tr key={data}>
                <td style={Styles.centerText}>{data}</td>
                <td style={{width: 86, textAlign: 'center'}}>
                    <button className="btn btn-link"
                            onClick={(event)=> {
            this.onDeleteClick(event, data, index)
        }}>
                        <i className="icon-trash"/>删除
                    </button>
                </td>
            </tr>)
        })}
        <tr>
            <td colSpan="2">
                <button className="btn btn-link"
                        onClick={this.onAddClick}>
                    <i className="icon-plus"/>添加邮箱
                </button>
            </td>
        </tr>
        </tbody>);
    },

    onAddClick: function (event) {
        $('#mailAddModal').modal();
        mailModalFunc = this.onMailAdd;
    },

    onMailAdd: function (mailArray) {
        $.each(mailArray, (index, mail)=> {
            mail = mail.trim();
            if (mail) {
                this.props.tableData.push(mail);
            }
        });
        this.setState({});
    },

    onDeleteClick: function (event, data, index) {
        var c = confirm('确定要删除[' + data + ']？');
        if (c) {
            this.props.tableData.splice(index, 1);
            this.setState({});
        }
    }
});

/**
 * 页面顶层布局
 */
var FlowView = React.createClass({

    getInitialState: function () {
        return {
            changed: false,
        };
    },

    render: function () {
        if (this.props.loading) {
            return (<span>
            <center><h3><i className="icon-spinner icon-spin"/>
            正在读取...</h3></center>
            </span>);
        }
        if (this.props.success) {
            let flowObj = this.props.response;
            let showData = [];
            for (let flowList in flowObj) {
                let flowName = flowObj[flowList];
                flowName.key = flowList;
                showData.push(flowName);
            }
            let changed = this.state.changed;
            return (<div style={{marginBottom: 50}}>
            <span>
            <center>
            <h3><i className=" icon-random"/>自动流配置</h3>
            </center>
            </span>
                <RepoList data={showData}
                          list={flowObj}
                          changed={changed}
                          onChecked={this.onChecked}
                          onChange={this.refreshList}/>
            </div>);
        } else {
            return (<span>
            <center><h3>Error...</h3></center>
            </span>);
        }
    },

    onChecked: function () {
        this.setState({});
        closeEditables();
    },

    refreshList: function (data) {
        this.setState({
            changed: true,
        });
    },
});


/**
 * 仓库列表布局
 */
var RepoList = React.createClass({

    render: function () {
        var index = 0;
        return (<center>
            <div style={{maxWidth: 750, minWidth: 640}}>
                <table className="table table-striped table-condensed table-bordered">
                    <tbody>
                    <tr className="info">
                        <td colSpan="4">
                            <div>
                                <button onClick={this.onBatchSelectClick}
                                        className="btn btn-default btn-sm">
                                    <i className="icon-reorder"/> 批量选择
                                </button>
                                <button onClick={this.onSelectByBranch}
                                        style={{marginLeft: 10}}
                                        className="btn btn-default btn-sm">
                                    <i className="icon-sitemap"/> 按分支选择
                                </button>
                                <button onClick={this.onSelectAll}
                                        style={{marginLeft: 10}}
                                        className="btn btn-default btn-sm">
                                    <i className="icon-th-list"/> 全选
                                </button>
                                <button onClick={this.onSelectReverse}
                                        style={{marginLeft: 10}}
                                        className="btn btn-default btn-sm">
                                    <i className="icon-exchange"/> 反选
                                </button>
                            </div>
                        </td>
                    </tr>
                    </tbody>
                    <RepoAdder list={this.props.list}
                               onChange={this.props.onChange}/>
                    {this.props.data.map((data)=> {
                        return (<FlowRepo data={data}
                                          index={index++}
                                          key={data.key}
                                          list={this.props.list}
                                          onChecked={this.props.onChecked}
                                          onChange={this.props.onChange}/>);
                    })}
                </table>
                <FloatBar list={this.props.list}
                          data={this.props.data}
                          onChange={this.props.onChange}
                          changed={this.props.changed}/>
            </div>
        </center>);
    },

    /**
     *  反选
     * @param event
     */
    onSelectReverse: function (event) {
        for (let index in this.props.list) {
            let repo = this.props.list[index];
            repo.checked = !repo.checked;
        }
        this.props.onChecked();
    },

    /**
     * 全选
     * @param event
     */
    onSelectAll: function (event) {
        for (let index in this.props.list) {
            let repo = this.props.list[index];
            repo.checked = true;
        }
        this.props.onChecked();
    },

    /**
     * 按分支选择
     * @param event
     */
    onSelectByBranch: function (event) {
        branchInputFunc = this.onBranchInput;
        $('#branchInputModal').modal();
    },

    /**
     * 批量选择
     * @param event
     */
    onBatchSelectClick: function (event) {
        selectModalFunc = this.selectModalFunc;
        $('#selectModal').modal();
    },

    onBranchInput: function (upStream, downStream) {
        //先重置之前所有选中
        for (let index in this.props.list) {
            let repo = this.props.list[index];
            repo.checked = existsBranch(repo, upStream, downStream);
        }
        this.props.onChecked();
    },

    /** 批量导入选中的repo, 参数是需要导入的repo数组*/
    selectModalFunc: function (repoArray) {
        //先重置之前所有选中
        for (let index in this.props.list) {
            let repo = this.props.list[index];
            repo.checked = false;
        }
        //按参数依次选中
        for (let index in repoArray) {
            let key = repoArray[index].trim();
            let repo = this.props.list[key];
            if (repo) {
                repo.checked = true
            } else if (key !== '') {
                this.props.list[key] = [];
                this.props.list[key].checked = true;
            }
        }
        this.props.onChecked();
    },
});

/**
 * 底部悬浮窗
 */
var FloatBar = React.createClass({
    render: function () {
        var hasChecked = false;
        for (var key in this.props.data) {
            if (this.props.data[key].checked) {
                hasChecked = true;
                break;
            }
        }
        return (<div className="navbar-fixed-bottom"
                     style={{background: '#F5F5F5', paddingTop: 10}}>
            <div style={{marginBottom: 10, float: 'right'}}>
                <button onClick={this.onUpClick}
                        style={{marginRight: 10, float: 'right'}}
                        className="btn btn-sm btn-default"><i className="icon-angle-up"/>Top
                </button>
                {this.props.changed &&
                <button onClick={this.onRefresh}
                        style={{marginRight: 10, float: 'right'}}
                        className="btn btn-sm btn-warning">放弃修改
                </button>}
                { this.props.changed &&
                <JsonSaver list={this.props.list}/>}
                {hasChecked &&
                <BatchOperation data={this.props.data}
                                onChange={this.props.onChange}/>}
            </div>
        </div>);
    },

    onUpClick: function () {
        window.scroll(0, 0);
    },

    onRefresh: function () {
        location.reload();
    }
});

/**
 * 批量操作
 * */
var BatchOperation = React.createClass({

    getInitialState(){
        return ({selection: '添加分支'});
    },

    selArray: [],

    componentDidMount() {
        /** 模态对话框是全局的，所以事件只能添加一次*/
        addModalFunc = this.addModalFunc;
        deleteModalFunc = this.deleteModalFunc;
        modalSelectionChange = this.onTypeChange;
    },

    render: function () {
        var total = 0;
        this.selArray = [];
        for (var key in this.props.data) {
            if (this.props.data[key].checked) {
                this.selArray.push(this.props.data[key]);
                total++;
            }
        }
        modalType = this.state.selection;
        var titleText = `您将对选中的${total}个仓库进行${modalType}操作`;
        $('#myModalLabel').html(titleText);
        $('#myModalSelect').val(this.state.selection);
        return (<div style={{marginRight: 10, float: 'right'}}>
            <a href="#myModal"
               role="button"
               className="btn btn-sm btn-info"
               data-toggle="modal">操作选中
            </a>
        </div>);
    },

    onTypeChange: function (event) {
        var value = event.target.value;
        if (this.isMounted()) {
            this.setState({selection: value});
        }
    },

    /** 批量添加分支*/
    addModalFunc: function (textUp, textDown) {
        for (var repo in this.selArray) {
            if (existsBranch(this.selArray[repo], textUp, textDown)) {
                continue
            }
            var branch = {
                downstream: textDown,
                upstream: textUp
            };
            this.selArray[repo].push(branch);
        }
        this.props.onChange();
    },

    /** 批量删除分支*/
    deleteModalFunc: function (textUp, textDown) {
        for (var repo in this.selArray) {
            var branchArr = this.selArray[repo];
            for (var branch in branchArr) {
                var branchObj = branchArr[branch];
                if (branchObj.upstream === textUp
                    && branchObj.downstream === textDown) {
                    branchArr.splice(branch, 1);
                }
            }
        }
        this.props.onChange();
    }
});

/**
 * 最后保存json按钮
 */
var JsonSaver = React.createClass({

    render: function () {
        return (<div style={{marginRight: 10, float: 'right'}}>
            <button onClick={this.onJsonSave}
                    className="btn btn-sm btn-primary">提交修改
            </button>
        </div>);
    },

    /** 点击提交按钮*/
    onJsonSave: function (event) {
        event.preventDefault();
        closeEditables();
        //生成json字符串
        let curContent = JSON.stringify(this.props.list, null, 2);
        commitJsonFile(curContent, originContentFlows, FILE_NAME_FLOWS);
    }
});

/**
 * 添加仓库布局
 */
var RepoAdder = React.createClass({
    mixins: [EditableMixIn],

    render: function () {
        if (this.state.editable) {
            return (<tbody>
            <tr className="info">
                <td colSpan="3">
                    <input type="text"
                           className="form-control"
                           ref="inputRepoName"
                           placeholder="Path of repository"/>
                </td>
                <td style={Styles.centerText}>
                    <div className="btn-group">
                        <button className="btn btn-sm btn-success" onClick={this.onRepoOk}>确定</button>
                        <button className="btn btn-sm btn-default" onClick={this.changeEditable}>取消</button>
                    </div>
                </td>
            </tr>
            </tbody>);
        } else {
            return (<tbody>
            <tr className="info">
                <td colSpan="4">
                    <button className="btn btn-link" onClick={this.changeEditable}>
                        <i className="icon-plus"/>添加仓库
                    </button>
                </td>
            </tr>
            </tbody>);
        }
    },

    /**
     * 编辑Repo名OK
     * @param event
     */
    onRepoOk: function (event) {
        event.preventDefault();
        let txtRepo = this.refs.inputRepoName.value.trim();
        if (txtRepo) {
            if (existsRepo(this.props.list, txtRepo)) {
                alert(`[${txtRepo}]已经存在了，请检查！`);
                return;
            }
            this.props.list[txtRepo] = [];
            this.props.onChange(this.props.list);
            this.changeEditable();
        }
    },
});


/**
 * 每个仓库布局
 */
var FlowRepo = React.createClass({
    mixins: [EditableMixIn],

    render: function () {
        return (<tbody>
        <RepoName data={this.props.data}
                  list={this.props.list}
                  index={this.props.index}
                  onChange={this.props.onChange}
                  onChecked={this.props.onChecked}
                  deleteRepo={this.deleteRepo}/>
        {
            this.props.data.map((branch, index)=> {
                return (<BranchName data={this.props.data}
                                    key={this.props.data.key + index}
                                    list={this.props.list}
                                    index={index}
                                    onChange={this.props.onChange}
                                    deleteBranch={this.deleteBranch}
                                    branch={branch}/>);
            })
        }
        {this.renderBranchAdd()}
        </tbody>);
    },

    /**
     * 添加分支布局
     * @returns {XML}
     */
    renderBranchAdd: function () {
        if (this.state.editable) {
            return (<tr>
                <td style={Styles.centerText}>
                    <input type="text"
                           ref="inputUpstream"
                           className="form-control"
                           placeholder="upstream"/>
                </td>
                <td style={Styles.centerText}>
                    <i className="icon-caret-right"/><i className="icon-caret-right"/>
                </td>
                <td style={Styles.centerText}>
                    <input type="text"
                           className="form-control"
                           ref="inputDownstream"
                           placeholder="downstream"/>
                </td>
                <td style={Styles.centerText}>
                    <div className="btn-group">
                        <button className="btn btn-sm btn-success" onClick={this.onBranchOk}>确定</button>
                        <button className="btn btn-sm btn-default" onClick={this.changeEditable}>取消</button>
                    </div>
                </td>
            </tr>);
        } else {
            return (<tr>
                <td colSpan="5">
                    <button className="btn btn-link" onClick={this.changeEditable}>
                        <i className="icon-plus"/>添加分支
                    </button>
                </td>
            </tr>);
        }
    },

    /**
     * 修改分支名确定
     */
    onBranchOk: function (event) {
        event.preventDefault();
        let txtUpstream = this.refs.inputUpstream.value.trim();
        let txtDownstream = this.refs.inputDownstream.value.trim();
        if (txtUpstream && txtDownstream) {
            let curList = this.props.list[this.props.data.key];
            if (existsBranch(curList, txtUpstream, txtDownstream)) {
                alert(`[${txtUpstream}->${txtDownstream}]已经存在了，请检查！`);
                return;
            }
            var branch = {
                downstream: txtDownstream,
                upstream: txtUpstream,
            };
            this.props.list[this.props.data.key].push(branch);
            this.props.onChange(this.props.list);
            this.setState({
                editable: false,
            });
        } else {
            return;
        }
    },

    /**
     * 删除分支
     * @param index
     */
    deleteBranch: function (index) {
        var branchList = this.props.list[this.props.data.key];
        var branchItem = branchList[index];
        var c = confirm('确定要删除[' + branchItem.upstream + '>>' + branchItem.downstream + ']？');
        if (c) {
            closeEditables();
            branchList.splice(index, 1);
            this.props.onChange(this.props.list);
        }
    },

    /**
     * 删除仓库
     */
    deleteRepo: function () {
        var repoName = this.props.data.key;
        var c = confirm('确定要删除[' + repoName + ']？');
        if (c) {
            closeEditables();
            delete this.props.list[repoName];
            this.props.onChange(this.props.list);
        }
    }

});


/**
 * 每个仓库名布局
 */
var RepoName = React.createClass({
    mixins: [EditableMixIn],

    render: function () {
        var checked = this.props.data.checked ? true : false;
        if (this.state.editable) {
            return (<tr className="success">
                <td>
                    <label>{this.props.index + 1}.</label>
                </td>
                <td colSpan="2">
                    <input type="text"
                           ref="inputRepoName"
                           className="form-control"
                           defaultValue={this.props.data.key}
                           placeholder="Path of repository"/>
                </td>
                <td style={Styles.centerText}>
                    <div className="btn-group">
                        <button className="btn btn-sm btn-success" onClick={this.onRepoOk}>确定</button>
                        <button className="btn btn-sm btn-default" onClick={this.changeEditable}>取消</button>
                    </div>
                </td>
            </tr>);
        } else {
            return (<tr className="success">
                <td style={Styles.centerText}>
                    <div class="checkbox">
                        <label>
                            <input type="checkbox"
                                   onChange={this.onCheckChange}
                                   checked={checked}/>
                            {this.props.index + 1}
                        </label>
                    </div>
                </td>
                <td colSpan="2" style={Styles.centerText}>
                    <span onClick={this.changeEditable}>{this.props.data.key}</span>
                </td>
                <td style={Styles.centerText}>
                    <button className="btn btn-link" onClick={this.deleteRepo}>
                        <i className="icon-trash"/>删除
                    </button>
                </td>
            </tr>);
        }
    },

    /**
     * 当checkbox发生改变时
     */
    onCheckChange: function (event) {
        let checked = event.target.checked;
        this.props.data.checked = checked;
        this.props.onChecked();
    },

    /**
     * 修改仓库名完成
     * @param event
     */
    onRepoOk: function (event) {
        event.preventDefault();
        var txtRepo = this.refs.inputRepoName.value.trim();
        if (txtRepo === '') {
            return;
        }
        if (txtRepo !== this.props.data.key) {
            if (existsRepo(this.props.list, txtRepo)) {
                alert(`[${txtRepo}]已经存在了，请检查！`);
                return;
            }
            this.props.list[txtRepo] = this.props.list[this.props.data.key];
            delete this.props.list[this.props.data.key];
            this.props.onChange(this.props.list);
        }
        this.setState({
            editable: false
        });
    },

    /**
     * 删除仓库事件
     * @param event
     */
    deleteRepo: function (event) {
        event.preventDefault();
        this.props.deleteRepo();
    }
});


/**
 * 每个分支名布局
 */
var BranchName = React.createClass({
    mixins: [EditableMixIn],

    render: function () {
        if (this.state.editable) {
            return (<tr>
                <td className="col-xs-4" style={Styles.centerText}>
                    <input type="text"
                           className="form-control"
                           defaultValue={this.props.branch.upstream}
                           ref="inputUpstream"
                           placeholder="upstream"/>
                </td>
                <td className="col-xs-2" style={Styles.centerText}>
				    <i className="icon-caret-right"/><i className="icon-caret-right"/>
				</td>
                <td className="col-xs-4" style={Styles.centerText}>
                    <input type="text"
                           className="form-control"
                           defaultValue={this.props.branch.downstream}
                           ref="inputDownstream"
                           placeholder="downstream"/>
                </td>
                <td className="col-xs-2" style={Styles.centerText}>
                    <div className="btn-group">
                        <button className="btn btn-sm btn-success" onClick={this.editBranchOk}>确定</button>
                        <button className="btn btn-sm btn-default" onClick={this.changeEditable}>取消</button>
                    </div>
                </td>
            </tr>);
        } else {
            return (<tr>
                <td className="col-xs-4" style={Styles.centerText}>
                    <span onClick={this.changeEditable}>{this.props.branch.upstream}</span>
                </td>
                <td className="col-xs-2" style={Styles.centerText}>
				    <i className="icon-caret-right"/><i className="icon-caret-right"/>
				</td>
                <td className="col-xs-4" style={Styles.centerText}>
                    <span onClick={this.changeEditable}>{this.props.branch.downstream}</span>
                </td>
                <td className="col-xs-2" style={Styles.centerText}>
                    <button className="btn btn-link" onClick={this.deleteBranch}>
                        <i className="icon-trash"/>删除
                    </button>
                </td>
            </tr>);
        }
    },

    /**
     * 分支名编辑完成
     * @param event
     */
    editBranchOk: function (event) {
        event.preventDefault();
        var txtUpstream = this.refs.inputUpstream.value.trim();
        var txtDownstream = this.refs.inputDownstream.value.trim();
        if (txtUpstream && txtDownstream) {
            let curList = this.props.list[this.props.data.key];
            if (existsBranch(curList, txtUpstream, txtDownstream)) {
                alert(`[${txtUpstream}->${txtDownstream}]已经存在了，请检查！`);
                return;
            }
            var obj = curList[this.props.index];
            obj.upstream = txtUpstream;
            obj.downstream = txtDownstream;
            this.props.onChange(this.props.list);
            this.setState({
                editable: false,
            });
        } else {
            return;
        }
    },

    deleteBranch: function (event) {
        event.preventDefault();
        this.props.deleteBranch(this.props.index);
    }
});

var Styles = {
    centerText: {
        textAlign: 'center'
    }
};

/**
 * 渲染根节点
 */
ReactDOM.render(
    <ContainerView/>
    ,
    document.getElementById('container')
);
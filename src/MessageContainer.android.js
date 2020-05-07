import React from 'react';

import {
  ListView,
  View,
  ScrollView,
  RefreshControl,
  Platform
} from 'react-native';

import shallowequal from 'shallowequal';
import InvertibleScrollView from 'react-native-invertible-scroll-view';
import md5 from 'md5';
import LoadEarlier from './LoadEarlier';
import Message from './Message';
import PropTypes from 'prop-types';
// import RefreshableListView from 'react-native-refreshable-listview';
// import PullToRefreshListView from 'react-native-smart-pull-to-refresh-listview'

const viewState = {
    refresh_none: 0,
    refresh_idle: 1,
    will_refresh: 2,
    refreshing: 3,
    refresh_freezing: 4,
    load_more_none: 5,
    load_more_idle: 6,
    will_load_more: 7,
    loading_more: 8,
    load_more_freezing: 9,
    loaded_all: 10,
}

export default class MessageContainer extends React.Component {

  static defaultProps = {
        pullDownDistance: 50,
        pullDownStayDistance: 35,
        enabledPullUp: true,
        enabledPullDown: true,
        autoLoadMore: false,
    }

    static propTypes = {
        pullDownDistance: PropTypes.number,
        pullDownStayDistance: PropTypes.number,
    }
  constructor(props) {
    super(props);
    this.renderRow = this.renderRow.bind(this);
    this.renderFooter = this.renderFooter.bind(this);
    this.renderLoadEarlier = this.renderLoadEarlier.bind(this);
    this.renderScrollComponent = this.renderScrollComponent.bind(this);
    this._onScroll = this._onScroll.bind(this);

    const dataSource = new ListView.DataSource({
      rowHasChanged: (r1, r2) => {
        return r1.hash !== r2.hash;
      }
    });

    const messagesData = this.prepareMessages(props.messages);
    this.state = {
      dataSource: dataSource.cloneWithRows(messagesData.blob, messagesData.keys),
      layoutStyle:'more'
    };


    let {refresh_none, load_more_none} = viewState
    // 为下拉加载更多写方法
    this._refreshState = refresh_none
    this._loadMoreState = load_more_none
    this._refreshBackAnimating = false
    this._loadMoreBackAnimating = false
    this._afterRefreshBacked = false
    this._afterLoadMoreBacked = false
    this._beginTimeStamp = null
    this._beginResetScrollTopTimeStamp = null
    this._refreshBackAnimationFrame = null
    this._touching = false
    this._scrollY = 0
    this._lastScrollY = 0
    this._fixedScrollY = 0
    this._refreshFixScrollY = 0
    this._paddingBlankDistance = 0

    this._listItemRefs = {}

    this._headerHeight = 0
    this._canLoadMore = false
    this._autoLoadFooterHeight = 0
    this._onRefreshed = false
  }

  prepareMessages(messages) {
    return {
      keys: messages.map(m => m._id),
      blob: messages.reduce((o, m, i) => {
        const previousMessage = messages[i + 1] || {};
        const nextMessage = messages[i - 1] || {};
        // add next and previous messages to hash to ensure updates
        const toHash = JSON.stringify(m) + previousMessage._id + nextMessage._id;
        o[m._id] = {
          ...m,
          previousMessage,
          nextMessage,
          hash: md5(toHash)
        };
        return o;
      }, {})
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (!shallowequal(this.props, nextProps)) {
      return true;
    }
    if (!shallowequal(this.state, nextState)) {
      return true;
    }
    return false;
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.messages === nextProps.messages) {
      return;
    }
    const messagesData = this.prepareMessages(nextProps.messages);
    this.setState({
      dataSource: this.state.dataSource.cloneWithRows(messagesData.blob, messagesData.keys)
    });
  }

  renderFooter() {
    if (this.props.renderFooter) {
      const footerProps = {
        ...this.props,
      };
      return this.props.renderFooter(footerProps);
    }
    return null;
  }

  renderLoadEarlier() {
    if (this.props.loadEarlier === true) {
      const loadEarlierProps = {
        ...this.props,
      };
      if (this.props.renderLoadEarlier) {
        return this.props.renderLoadEarlier(loadEarlierProps);
      }
      if( this.props.noMore ){
        return null
      }
      return (
        <LoadEarlier {...loadEarlierProps}/>
      );
    }
    return null;
  }

  scrollTo(options) {
    this._invertibleScrollViewRef.scrollTo(options);
  }

  renderRow(message, sectionId, rowId) {
    if (!message._id && message._id !== 0) {
      console.warn('GiftedChat: `_id` is missing for message', JSON.stringify(message));
    }
    if (!message.user) {
      // console.warn('GiftedChat: `user` is missing for message', JSON.stringify(message));
      message.user = {};
    }

    const messageProps = {
      ...this.props,
      key: message._id,
      currentMessage: message,
      previousMessage: message.previousMessage,
      nextMessage: message.nextMessage,
    };

    if (this.props.renderMessage) {
      return this.props.renderMessage(messageProps);
    }
    return <Message {...messageProps}/>;
  }

  renderScrollComponent(props) {
    const invertibleScrollViewProps = this.props.invertibleScrollViewProps;
    if( this.state.layoutStyle==='noMore' ){
      return <ScrollView 
        {...props} 
        ref={ (component) => this._scrollView = component }
      />;
    }else{
      return (
        <InvertibleScrollView
          {...props}
          {...invertibleScrollViewProps}
          ref={component => this._scrollView = component}
        />
      );
    }
    
  }

  render() {
    return (
      <View ref='container' style={{flex:1}}>
      {
        <ListView
          enableEmptySections={true}
          automaticallyAdjustContentInsets={false}
          initialListSize={20}
          pageSize={20}
          {...this.props.listViewProps}
          dataSource={this.state.dataSource}
          renderRow={this.renderRow}
          renderHeader={this.state.layoutStyle==='noMore'?this.renderLoadEarlier:this.renderFooter}
          renderFooter={this.state.layoutStyle==='noMore'?this.renderFooter:this.renderLoadEarlier}
          renderScrollComponent={this.renderScrollComponent}
          scrollEventThrottle={16}
          onScroll={ this._onScroll }
          
          onContentSizeChange={(width,contentHeight)=>{
            // TODO：这里的50应该表示点击加载更多的height
            // if( contentHeight > 50 ){
            //   if(this.props.height>contentHeight){
            //     this.setState({layoutStyle:'noMore'});
            //   }else{
            //     this.setState({layoutStyle:'more'});
            //   }
            // }

            this._scrollViewContainerHeight = this.props.height;
            this._scrollViewContentHeight = contentHeight;
          }}
        />
      }
      </View>
    );
  }

  _onScroll(e){
    let {refresh_none, refresh_idle, will_refresh, refreshing,
            load_more_none, load_more_idle, will_load_more, loading_more, loaded_all,} = viewState
        let {pullUpDistance, pullDownDistance, autoLoadMore, enabledPullUp, enabledPullDown, } = this.props

        this._scrollY = Math.ceil(e.nativeEvent.contentOffset.y)
        // 下拉加载更多
        if (this._scrollY < this._lastScrollY) {
            if (this._refreshState == refresh_none && !this._refreshBackAnimating && !this._afterRefreshBacked) {
                if (this._refreshState != refreshing && this._loadMoreState != loading_more && this._scrollY > (this._scrollViewContentHeight - this._scrollViewContainerHeight)) {
                    this._refreshState = refresh_idle
                }
            }
        }
       

        if (this._scrollY > Math.ceil(this._scrollViewContentHeight - this._scrollViewContainerHeight)) {
            if (this._refreshState == refresh_idle || this._refreshState == will_refresh) {
                let offsetY = this._scrollY - (this._scrollViewContentHeight - this._scrollViewContainerHeight);
                if (offsetY >= pullDownDistance) {
                    if (this._refreshState == refresh_idle) {
                        this._refreshState = will_refresh
                        this._shouldLoad = true;
                    }
                }
                else {
                    if (this._refreshState == will_refresh) {
                        this._refreshState = refresh_idle
                    }
                }
            }
        }
        else {
            if (this._scrollY == Math.ceil(this._scrollViewContentHeight - this._scrollViewContainerHeight)) {
                if (this._refreshState == refresh_idle && this._shouldLoad) {
                    this._refreshState = refresh_none
                    this._shouldLoad = false;
                    this.props.onLoadEarlier && this.props.onLoadEarlier();
                }
            }else{
              if(this._refreshState == refresh_none){
                this.props.onLoadEarlier && this.props.onLoadEarlier();
              }
            }
        }
        this._lastScrollY = this._scrollY
  }
}

MessageContainer.defaultProps = {
  messages: [],
  renderFooter: null,
  renderMessage: null,
  listViewProps: {},
  onLoadEarlier: () => {
  },
};

MessageContainer.propTypes = {
  messages: PropTypes.array,
  renderFooter: PropTypes.func,
  renderMessage: PropTypes.func,
  onLoadEarlier: PropTypes.func,
  listViewProps: PropTypes.object,
};

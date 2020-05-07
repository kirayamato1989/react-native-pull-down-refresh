import React from 'react';
import {
  Animated,
  InteractionManager,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import PropTypes from 'prop-types';

import ActionSheet from '@expo/react-native-action-sheet';
import moment from 'moment/min/moment-with-locales.min';
import uuid from 'uuid';
import * as utils from './utils';
import Bubble from './Bubble';
import Day from './Day';
import LoadEarlier from './LoadEarlier';
import Message from './Message';
import MessageContainer from './MessageContainer';
import Time from './Time';
import GiftedChatInteractionManager from './GiftedChatInteractionManager';

// Min and max heights of ToolbarInput and Composer
// Needed for Composer auto grow and ScrollView animation
// TODO move these values to Constants.js (also with used colors #b2b2b2)
// 这个高度值是怎么确认的？
const MIN_COMPOSER_HEIGHT = Platform.select({
  ios: 33,
  android: 41,
});

const MAX_COMPOSER_HEIGHT = 100;

class PullDownRefresh extends React.Component {
  constructor(props) {
    super(props);

    // default values
    this._isMounted = false; // 这个的作用？
    this._bottomOffset = 0;
    this._maxHeight = null;
    this._isFirstLayout = true;
    this._locale = 'en'; // 有啥作用呀，感觉是设置时间的格式
    this._messages = [];

    this.state = {
      isInitialized: false, // initialization will calculate maxHeight before rendering the chat
      composerHeight: MIN_COMPOSER_HEIGHT,//这个是什么的高度
      messagesContainerHeight: null,
      messagesContainerHeight2:0,
      typingDisabled: false// 这个的作用是什么
    };

    // this.getLocale = this.getLocale.bind(this);
    this.onMainViewLayout = this.onMainViewLayout.bind(this);
    this.onInitialLayoutViewLayout = this.onInitialLayoutViewLayout.bind(this);


    this.invertibleScrollViewProps = {
      inverted: true,
      keyboardShouldPersistTaps: this.props.keyboardShouldPersistTaps,
    };
  }

  static append(currentMessages = [], messages) {
    if (!Array.isArray(messages)) {
      messages = [messages];
    }
    return messages.concat(currentMessages);
  }

  static prepend(currentMessages = [], messages) {
    if (!Array.isArray(messages)) {
      messages = [messages];
    }
    return currentMessages.concat(messages);
  }

  componentWillMount() {
    this.setIsMounted(true);
    //this.initLocale();
    this.initMessages(this.props.messages);
  }

  componentWillUnmount() {
    this.setIsMounted(false);
  }

  componentWillReceiveProps(nextProps = {}) {
    this.initMessages(nextProps.messages);
  }

  initMessages(messages = []) {
    this.setMessages(messages);
  }

  setMessages(messages) {
    this._messages = messages;
  }

  getMessages() {
    return this._messages;
  }

  setMaxHeight(height) {
    this._maxHeight = height;
  }

  getMaxHeight() {
    return this._maxHeight;
  }

  setIsFirstLayout(value) {
    this._isFirstLayout = value;
  }

  getIsFirstLayout() {
    return this._isFirstLayout;
  }

  setIsTypingDisabled(value) {
    this.setState({
      typingDisabled: value
    });
  }

  getIsTypingDisabled() {
    return this.state.typingDisabled;
  }

  setIsMounted(value) {
    this._isMounted = value;
  }

  getIsMounted() {
    return this._isMounted;
  }

  // TODO
  // setMinInputToolbarHeight
  getMinInputToolbarHeight() {
    return this.props.renderAccessory ? this.props.minInputToolbarHeight * 2 : this.props.minInputToolbarHeight;
  }

  calculateInputToolbarHeight(composerHeight) {
    return composerHeight  - MIN_COMPOSER_HEIGHT;
  }

  /**
   * Returns the height, based on current window size, without taking the keyboard into account.
   */
  getBasicMessagesContainerHeight(composerHeight = this.state.composerHeight) {
    return this.getMaxHeight();
  }

  /**
   * Returns the height, based on current window size, taking the keyboard into account.
   */
  getMessagesContainerHeightWithKeyboard(composerHeight = this.state.composerHeight) {
    return this.getBasicMessagesContainerHeight(composerHeight);
  }

  prepareMessagesContainerHeight(value) {
    if (this.props.isAnimated === true) {
      return new Animated.Value(value);
    }
    return value;
  }

  renderMessages() {
    const AnimatedView = this.props.isAnimated === true ? Animated.View : View;
    return (
      <AnimatedView style={{
        height: this.state.messagesContainerHeight,
      }}>
        <MessageContainer
          {...this.props}

          invertibleScrollViewProps={this.invertibleScrollViewProps}

          messages={this.getMessages()}

          ref={component => this._messageContainerRef = component}

          height={this.state.messagesContainerHeight2}
        />
      </AnimatedView>
    );
  }

  onInitialLayoutViewLayout(e) {
    const layout = e.nativeEvent.layout;
    if (layout.height <= 0) {
      return;
    }
    this.setMaxHeight(layout.height);
    const newComposerHeight = MIN_COMPOSER_HEIGHT;
    const newMessagesContainerHeight = this.getMessagesContainerHeightWithKeyboard(newComposerHeight);

    // 安排一个任务在交互和动画完成之后执行?这里是指的什么交互？什么动画？
    GiftedChatInteractionManager.runAfterInteractions(() => {
      this.setState({
        isInitialized: true,
        text: '',
        composerHeight: newComposerHeight,
        messagesContainerHeight: this.prepareMessagesContainerHeight(newMessagesContainerHeight),
        messagesContainerHeight2:newMessagesContainerHeight
      });
    });
  }

  onMainViewLayout(e) {
    // fix an issue when keyboard is dismissing during the initialization
    // 第一次firstLayout是什么意思？第一次加载message？
    const layout = e.nativeEvent.layout;
    if (this.getMaxHeight() !== layout.height || this.getIsFirstLayout() === true) {
      this.setMaxHeight(layout.height);
      this.setState({
        messagesContainerHeight: this.prepareMessagesContainerHeight(this.getBasicMessagesContainerHeight()),
        messagesContainerHeight2:this.getBasicMessagesContainerHeight()
      });
    }
    if (this.getIsFirstLayout() === true) {
      this.setIsFirstLayout(false);
    }
  }

  renderInputToolbar() {
    const inputToolbarProps = {
      ...this.props,
      text: this.state.text,
      composerHeight: Math.max(MIN_COMPOSER_HEIGHT, this.state.composerHeight),
      onSend: this.onSend,
      onInputSizeChanged: this.onInputSizeChanged,
      onTextChanged: this.onInputTextChanged,
      textInputProps: {
        ...this.props.textInputProps,
        ref: textInput => this.textInput = textInput,
        maxLength: this.getIsTypingDisabled() ? 0 : this.props.maxInputLength
      }
    };
    if (this.getIsTypingDisabled()) {
      inputToolbarProps.textInputProps.maxLength = 0;
    }
    if (this.props.renderInputToolbar) {
      return this.props.renderInputToolbar(inputToolbarProps);
    }
    return (
      <InputToolbar
        {...inputToolbarProps}
      />
    );
  }

  renderLoading() {
    if (this.props.renderLoading) {
      return this.props.renderLoading();
    }
    return null;
  }

  render() {
    if (this.state.isInitialized === true) {
      return (
        <ActionSheet ref={component => this._actionSheetRef = component}>
          <View style={styles.container} onLayout={this.onMainViewLayout}>
            {this.renderMessages()}
          </View>
        </ActionSheet>
      );
    }
    return (
      <View style={styles.container} onLayout={this.onInitialLayoutViewLayout}>
        {this.renderLoading()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

PullDownRefresh.childContextTypes = {
  actionSheet: PropTypes.func,
  getLocale: PropTypes.func,
};

PullDownRefresh.defaultProps = {
  messages: [],
  loadEarlier: false,
  onLoadEarlier: () => {
  },
  locale: null,
  isAnimated: Platform.select({
    ios: true,
    android: false,
  }),
  keyboardShouldPersistTaps: Platform.select({
    ios: 'never',
    android: 'always',
  }),
  renderAccessory: null, // 作用是什么？只是让minInputToolbarHeight*2么？
  renderActions: null,
  renderAvatar: null,
  renderBubble: null,
  renderChatFooter: null,
  renderMessageText: null,
  renderMessageImage: null,
  renderComposer: null,
  renderCustomView: null,
  renderDay: null,
  renderInputToolbar: null,
  renderLoadEarlier: null,
  renderLoading: null,
  renderMessage: null,
  renderSend: null,
  renderTime: null,
  user: {},
  bottomOffset: 0,
  minInputToolbarHeight: 44,
  isLoadingEarlier: false,
  messageIdGenerator: () => uuid.v4(),
  maxInputLength: null,
  pullDownDistance: 50,
  pullDownStayDistance: 35,
};

PullDownRefresh.propTypes = {
  messages: PropTypes.array,
  onSend: PropTypes.func,
  loadEarlier: PropTypes.bool,
  onLoadEarlier: PropTypes.func,
  locale: PropTypes.string,
  isAnimated: PropTypes.bool,
  renderAccessory: PropTypes.func,
  renderActions: PropTypes.func,
  renderAvatar: PropTypes.func,
  renderBubble: PropTypes.func,
  renderChatFooter: PropTypes.func,
  renderMessageText: PropTypes.func,
  renderMessageImage: PropTypes.func,
  renderComposer: PropTypes.func,
  renderCustomView: PropTypes.func,
  renderDay: PropTypes.func,
  renderInputToolbar: PropTypes.func,
  renderLoadEarlier: PropTypes.func,
  renderLoading: PropTypes.func,
  renderMessage: PropTypes.func,
  renderSend: PropTypes.func,
  renderTime: PropTypes.func,
  user: PropTypes.object,
  bottomOffset: PropTypes.number,
  minInputToolbarHeight: PropTypes.number,
  isLoadingEarlier: PropTypes.bool,
  messageIdGenerator: PropTypes.func,
  keyboardShouldPersistTaps: PropTypes.oneOf(['always', 'never', 'handled']),
};

export {
  PullDownRefresh,
  Bubble,
  Day,
  LoadEarlier,
  Message,
  MessageContainer,
  Time,
  utils
};

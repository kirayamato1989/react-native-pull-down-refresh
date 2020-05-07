import React from 'react';
import {
  View,
  StyleSheet,
  ViewPropTypes
} from 'react-native';
import PropTypes from 'prop-types';

import Bubble from './Bubble';
import Day from './Day';

import {isSameDay} from './utils';

export default class Message extends React.Component {

  getInnerComponentProps() {
    const {containerStyle, ...props} = this.props;
    return {
      ...props,
      isSameDay
    }
  }

  renderDay() {
    if (this.props.currentMessage.createdAt) {
      const dayProps = this.getInnerComponentProps();
      if (this.props.renderDay) {
        return this.props.renderDay(dayProps);
      }
      return <Day {...dayProps}/>;
    }
    return null;
  }

  renderBubble() {
    const bubbleProps = this.getInnerComponentProps();
    if (this.props.renderBubble) {
      return this.props.renderBubble(bubbleProps);
    }
    return <Bubble {...bubbleProps}/>;
  }

  render() {
    return (
      <View>
        {this.renderDay()}
        <View style={[styles.container, this.props.containerStyle.container]}>
          {this.renderBubble()}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      marginLeft: 0,
      marginRight: 0,
    },
  });

Message.defaultProps = {
  renderBubble: null,
  renderDay: null,
  currentMessage: {},
  nextMessage: {},
  previousMessage: {},
  containerStyle: {},
};

Message.propTypes = {
  renderBubble: PropTypes.func,
  renderDay: PropTypes.func,
  currentMessage: PropTypes.object,
  nextMessage: PropTypes.object,
  previousMessage: PropTypes.object,
  containerStyle: PropTypes.shape({
    container: ViewPropTypes.style,
  }),
};

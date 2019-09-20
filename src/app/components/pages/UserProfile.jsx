/* eslint react/prop-types: 0 */
import React from 'react';
import { Link } from 'react-router';
import { connect } from 'react-redux';
import { browserHistory } from 'react-router';
import classnames from 'classnames';
import * as globalActions from 'app/redux/GlobalReducer';
import * as transactionActions from 'app/redux/TransactionReducer';
import * as userActions from 'app/redux/UserReducer';
import { actions as fetchDataSagaActions } from 'app/redux/FetchDataSaga';
import Icon from 'app/components/elements/Icon';
import Settings from 'app/components/modules/Settings';
import UserList from 'app/components/elements/UserList';
import Follow from 'app/components/elements/Follow';
import LoadingIndicator from 'app/components/elements/LoadingIndicator';
import PostsList from 'app/components/cards/PostsList';
import { isFetchingOrRecentlyUpdated } from 'app/utils/StateFunctions';
import { repLog10 } from 'app/utils/ParsersAndFormatters.js';
import Tooltip from 'app/components/elements/Tooltip';
import DateJoinWrapper from 'app/components/elements/DateJoinWrapper';
import tt from 'counterpart';
import { List } from 'immutable';
import Userpic from 'app/components/elements/Userpic';
import Callout from 'app/components/elements/Callout';
import normalizeProfile from 'app/utils/NormalizeProfile';
import userIllegalContent from 'app/utils/userIllegalContent';
import AffiliationMap from 'app/utils/AffiliationMap';
import proxifyImageUrl from 'app/utils/ProxifyUrl';
import ArticleLayoutSelector from 'app/components/modules/ArticleLayoutSelector';
import SanitizedLink from 'app/components/elements/SanitizedLink';
import { actions as UserProfilesSagaActions } from 'app/redux/UserProfilesSaga';

export default class UserProfile extends React.Component {
    constructor() {
        super();
        this.state = { showResteem: true };
        this.loadMore = this.loadMore.bind(this);
    }

    componentWillMount() {
        const { profile, accountname, fetchProfile } = this.props;
        if (!profile) fetchProfile(accountname);
    }

    shouldComponentUpdate(np, ns) {
        const { follow, follow_count, accountname } = this.props;

        let followersLoading = false,
            npFollowersLoading = false;
        let followingLoading = false,
            npFollowingLoading = false;

        if (follow) {
            followersLoading = follow.getIn(
                ['getFollowersAsync', accountname, 'blog_loading'],
                false
            );
            followingLoading = follow.getIn(
                ['getFollowingAsync', accountname, 'blog_loading'],
                false
            );
        }
        if (np.follow) {
            npFollowersLoading = np.follow.getIn(
                ['getFollowersAsync', accountname, 'blog_loading'],
                false
            );
            npFollowingLoading = np.follow.getIn(
                ['getFollowingAsync', accountname, 'blog_loading'],
                false
            );
        }

        return (
            np.current_user !== this.props.current_user ||
            np.global_status !== this.props.global_status ||
            (npFollowersLoading !== followersLoading && !npFollowersLoading) ||
            (npFollowingLoading !== followingLoading && !npFollowingLoading) ||
            np.loading !== this.props.loading ||
            np.location.pathname !== this.props.location.pathname ||
            np.follow_count !== this.props.follow_count ||
            np.blogmode !== this.props.blogmode ||
            np.posts !== this.props.posts ||
            np.profile !== this.props.profile ||
            ns.showResteem !== this.state.showResteem
        );
    }

    loadMore(last_post) {
        if (!last_post) return;
        const {
            accountname,
            current_user,
            global_status,
            order,
            category,
        } = this.props;

        if (isFetchingOrRecentlyUpdated(global_status, order, category)) {
            return;
        }

        const postFilter =
            order != 'blog' || this.state.showResteem
                ? null
                : value => value.author === accountname;

        const [author, permlink] = last_post.split('/');
        this.props.requestData({
            author,
            permlink,
            order,
            category,
            postFilter,
            observer: current_user ? current_user.get('username') : null,
        });
    }

    toggleShowResteem = e => {
        e.preventDefault();
        const newShowResteem = !this.state.showResteem;
        this.setState({ showResteem: newShowResteem });
    };

    render() {
        const {
            state: { showResteem },
            props: {
                current_user,
                global_status,
                follow,
                accountname,
                walletUrl,
                category,
                section,
                order,
                posts,
                profile,
            },
        } = this;
        const username = current_user ? current_user.get('username') : null;

        // Loading status
        const status = global_status
            ? global_status.getIn([category, order])
            : null;
        const fetching = (status && status.fetching) || this.props.loading;

        if (profile) {
        } else if (fetching) {
            return (
                <center>
                    <LoadingIndicator type="circle" />
                </center>
            );
        } else {
            return (
                <div>
                    <center>{tt('user_profile.unknown_account')}</center>
                </div>
            );
        }
        const followers =
            follow && follow.getIn(['getFollowersAsync', accountname]);
        const following =
            follow && follow.getIn(['getFollowingAsync', accountname]);

        // instantiate following items
        let totalCounts = this.props.follow_count;
        let followerCount = 0;
        let followingCount = 0;

        if (totalCounts && accountname) {
            totalCounts = totalCounts.get(accountname);
            if (totalCounts) {
                totalCounts = totalCounts.toJS();
                followerCount = totalCounts.follower_count;
                followingCount = totalCounts.following_count;
            }
        }

        const rep = repLog10(profile.get('reputation', 0));

        const isMyAccount = username === accountname;
        let tab_content = null;

        if (section === 'followers') {
            if (followers && followers.has('blog_result')) {
                tab_content = (
                    <div>
                        <UserList
                            title={tt('user_profile.followers')}
                            users={followers.get('blog_result')}
                        />
                    </div>
                );
            }
        } else if (section === 'followed') {
            if (following && following.has('blog_result')) {
                tab_content = (
                    <UserList
                        title="Followed"
                        users={following.get('blog_result')}
                    />
                );
            }
        } else if (section === 'settings') {
            tab_content = <Settings routeParams={this.props.routeParams} />;

            // post lists -- not loaded
        } else if (!posts) {
            tab_content = (
                <center>
                    <LoadingIndicator type="circle" />
                </center>
            );

            // post lists -- empty
        } else if (!fetching && !posts.size) {
            let emptyText;
            if (section == 'blog') {
                if (isMyAccount) {
                    emptyText = (
                        <div>
                            {tt(
                                'user_profile.looks_like_you_havent_posted_anything_yet'
                            )}
                            <br />
                            <br />
                            <Link to="/submit.html">
                                {tt('user_profile.create_a_post')}
                            </Link>
                            <br />
                            <Link to="/trending">
                                {tt('user_profile.explore_trending_articles')}
                            </Link>
                            <br />
                            <Link to="/welcome">
                                {tt('user_profile.read_the_quick_start_guide')}
                            </Link>
                            <br />
                            <Link to="/faq.html">
                                {tt('user_profile.browse_the_faq')}
                            </Link>
                            <br />
                        </div>
                    );
                } else {
                    emptyText = tt(
                        'user_profile.user_hasnt_started_bloggin_yet',
                        {
                            name: accountname,
                        }
                    );
                }
            } else if (section == 'comments') {
                emptyText = tt('user_profile.user_hasnt_made_any_posts_yet', {
                    name: accountname,
                });
            } else if (section == 'replies') {
                emptyText =
                    tt('user_profile.user_hasnt_had_any_replies_yet', {
                        name: accountname,
                    }) + '.';
            } else if (section == 'payout') {
                emptyText = 'No pending payouts.';
            }

            tab_content = <Callout>{emptyText}</Callout>;

            // post lists -- loaded
        } else {
            tab_content = (
                <PostsList
                    account={accountname} // 'blog' only
                    posts={posts}
                    loading={fetching}
                    loadMore={this.loadMore}
                    showPinned={false}
                    showResteem={showResteem} // 'blog' only
                    showSpam
                />
            );

            if (section === 'blog') {
                tab_content = (
                    <div>
                        <a href="#" onClick={this.toggleShowResteem}>
                            {showResteem
                                ? tt('user_profile.hide_resteems')
                                : tt('user_profile.show_all')}
                        </a>
                        {tab_content}
                    </div>
                );
            }
        }

        // detect illegal users
        if (userIllegalContent.includes(accountname)) {
            tab_content = <div>Unavailable For Legal Reasons.</div>;
        }

        var page_title = '';
        if (section === 'blog') {
            page_title = isMyAccount ? tt('g.my_blog') : tt('g.blog');
        } else if (section === 'comments') {
            page_title = isMyAccount ? tt('g.my_comments') : tt('g.comments');
        } else if (section === 'replies') {
            page_title = isMyAccount ? tt('g.my_replies') : tt('g.replies');
        } else if (section === 'settings') {
            page_title = tt('g.settings');
        } else if (section === 'payout') {
            page_title = tt('voting_jsx.payout');
        }

        const layoutClass = this.props.blogmode
            ? 'layout-block'
            : 'layout-list';

        const tab_header = (
            <div>
                <div className="articles__header">
                    <div className="articles__header-col">
                        <h1 className="articles__h1">{page_title}</h1>
                    </div>
                    <div className="articles__header-col articles__header-col--right">
                        {order && <ArticleLayoutSelector />}
                    </div>
                </div>
                <hr className="articles__hr" />
            </div>
        );

        tab_content = (
            <div className="row">
                <div
                    className={classnames(
                        'UserProfile__tab_content',
                        'column',
                        layoutClass
                    )}
                >
                    <article className="articles">
                        {tab_header}
                        {tab_content}
                    </article>
                </div>
            </div>
        );

        const _tablink = (tab, label) => (
            <Link to={`/@${accountname}${tab}`} activeClassName="active">
                {label}
            </Link>
        );
        const _walletlink = (url, label) => (
            <a href={`${url}/@${accountname}`} target="_blank">
                {label}
            </a>
        );

        const top_menu = (
            <div className="row UserProfile__top-menu">
                <div className="columns small-10 medium-12 medium-expand">
                    <ul className="menu" style={{ flexWrap: 'wrap' }}>
                        <li>{_tablink('', tt('g.blog'))}</li>
                        <li>{_tablink('/comments', tt('g.comments'))}</li>
                        <li>{_tablink('/recent-replies', tt('g.replies'))}</li>
                        <li>{_tablink('/payout', tt('voting_jsx.payout'))}</li>
                    </ul>
                </div>
                <div className="columns shrink">
                    <ul className="menu" style={{ flexWrap: 'wrap' }}>
                        <li>{_walletlink(walletUrl, tt('g.wallet'))}</li>
                        {isMyAccount && (
                            <li>{_tablink('/settings', tt('g.settings'))}</li>
                        )}
                    </ul>
                </div>
            </div>
        );

        const {
            name,
            location,
            about,
            website,
            cover_image,
        } = normalizeProfile(profile.toJS());
        const website_label = website
            ? website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
            : null;

        let cover_image_style = {};
        if (cover_image) {
            cover_image_style = {
                backgroundImage:
                    'url(' + proxifyImageUrl(cover_image, '2048x512') + ')',
            };
        }

        return (
            <div className="UserProfile">
                <div className="UserProfile__banner row expanded">
                    <div className="column" style={cover_image_style}>
                        <div style={{ position: 'relative' }}>
                            <div className="UserProfile__buttons hide-for-small-only">
                                <Follow
                                    follower={username}
                                    following={accountname}
                                />
                            </div>
                        </div>
                        <h1>
                            <Userpic account={accountname} hideIfDefault />
                            {name || accountname}{' '}
                            <Tooltip
                                t={tt(
                                    'user_profile.this_is_users_reputations_score_it_is_based_on_history_of_votes',
                                    { name: accountname }
                                )}
                            >
                                <span className="UserProfile__rep">
                                    ({rep})
                                </span>
                            </Tooltip>
                            {AffiliationMap[accountname] ? (
                                <span className="affiliation">
                                    {tt(
                                        'g.affiliation_' +
                                            AffiliationMap[accountname]
                                    )}
                                </span>
                            ) : null}
                        </h1>

                        <div>
                            {about && (
                                <p className="UserProfile__bio">{about}</p>
                            )}
                            <div className="UserProfile__stats">
                                <span>
                                    <Link to={`/@${accountname}/followers`}>
                                        {tt('user_profile.follower_count', {
                                            count: followerCount,
                                        })}
                                    </Link>
                                </span>
                                <span>
                                    <Link to={`/@${accountname}`}>
                                        {tt('user_profile.post_count', {
                                            count: profile.get('post_count', 0),
                                        })}
                                    </Link>
                                </span>
                                <span>
                                    <Link to={`/@${accountname}/followed`}>
                                        {tt('user_profile.followed_count', {
                                            count: followingCount,
                                        })}
                                    </Link>
                                </span>
                            </div>

                            <p className="UserProfile__info">
                                {location && (
                                    <span>
                                        <Icon name="location" /> {location}
                                    </span>
                                )}
                                {website && (
                                    <span>
                                        <Icon name="link" />{' '}
                                        <SanitizedLink
                                            url={website}
                                            text={website_label}
                                        />
                                    </span>
                                )}
                                <Icon name="calendar" />{' '}
                                <DateJoinWrapper
                                    date={profile.get('created')}
                                />
                            </p>
                        </div>
                        <div className="UserProfile__buttons_mobile show-for-small-only">
                            <Follow
                                follower={username}
                                following={accountname}
                                what="blog"
                            />
                        </div>
                    </div>
                </div>
                <div className="UserProfile__top-nav row expanded">
                    {top_menu}
                </div>
                <div>{tab_content}</div>
            </div>
        );
    }
}

module.exports = {
    path: '@:accountname(/:section)',
    component: connect(
        (state, ownProps) => {
            const current_user = state.user.get('current');
            const accountname = ownProps.routeParams.accountname.toLowerCase();
            const walletUrl = state.app.get('walletUrl');

            let { section } = ownProps.routeParams;
            if (!section) section = 'blog';
            if (section == 'recent-replies') section = 'replies';
            const order = ['blog', 'comments', 'replies', 'payout'].includes(
                section
            )
                ? section
                : null;

            return {
                posts: state.global.getIn([
                    'discussion_idx',
                    '@' + accountname,
                    order,
                ]),
                current_user,
                loading: state.app.get('loading'),
                global_status: state.global.get('status'),
                accountname: accountname,
                follow: state.global.get('follow'),
                follow_count: state.global.get('follow_count'),
                blogmode: state.app.getIn(['user_preferences', 'blogmode']),
                profile: state.userProfiles.getIn(['profiles', accountname]),
                walletUrl,
                section,
                order,
                category: '@' + accountname,
            };
        },
        dispatch => ({
            login: () => {
                dispatch(userActions.showLogin());
            },
            requestData: args =>
                dispatch(fetchDataSagaActions.requestData(args)),
            fetchProfile: author =>
                dispatch(UserProfilesSagaActions.fetchProfile(author)),
        })
    )(UserProfile),
};
